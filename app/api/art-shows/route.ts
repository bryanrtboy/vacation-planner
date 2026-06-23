import { NextResponse } from "next/server";
import { findArtShowsWithSerpApi } from "@/lib/art-shows/serpapi";
import {
  artShowWatchStorageState,
  claimNextArtShowSearchBatch,
  createArtShowSearchRun,
  expireStaleArtShowSearchBatches,
  expireStaleArtShowSearchRunsWithoutBatches,
  getArtShowSearchProgress,
  getActiveArtShowSearchRun,
  getLatestArtShowSearchRun,
  listArtShowLeads,
  listArtWatchTermsWithSeed,
  markArtWatchTermsSearchFailed,
  markArtWatchTermsSearched,
  replaceArtWatchTerms,
  summarizeArtShowSearchRun,
  updateArtShowSearchBatch,
  updateArtShowSearchRun,
  updateArtShowLeadStatus,
  writeArtShowLeads
} from "@/lib/storage/art-show-watch-store";
import {
  getUsageState,
  tryReserveChecks
} from "@/lib/price-watch/usage-store";
import type { ArtShowLeadStatus } from "@/lib/types";

export const runtime = "nodejs";

const artShowUsageService = "serpapi";
const artShowSearchTimeoutMs = 1000 * 60 * 2;
const artShowSearchFreshDays = 30;
const artShowSearchFailureCooldownDays = 30;

function labelsFromText(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80);
}

function artWatchTermIsDue(
  term: { active: boolean; lastSearchedAt?: string; lastFailedAt?: string },
  searchedCutoffIso: string,
  failedCutoffIso: string
) {
  if (!term.active) return false;
  if (term.lastFailedAt && term.lastFailedAt >= failedCutoffIso) return false;
  return !term.lastSearchedAt || term.lastSearchedAt < searchedCutoffIso;
}

function artShowSearchErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to search art shows right now.";
  const normalized = message.toLowerCase();

  if (normalized.includes("quota") || normalized.includes("rate limit")) {
    return [
      "The art show search could not run because provider quota is unavailable.",
      "This search now uses SerpAPI Google organic results, not Gemini grounding. Check the SerpAPI key, billing, and daily cap."
    ].join(" ");
  }

  if (normalized.includes("api key") || normalized.includes("serpapi key")) {
    return "SerpAPI key is missing or unavailable in Cloudflare. Add SERPAPI_API_KEY as a Cloudflare secret before searching shows.";
  }

  if (normalized.includes("abort") || normalized.includes("timeout")) {
    return "Art show source search timed out before SerpAPI returned Google results. This batch can retry in a future sweep.";
  }

  return message;
}

async function artShowsPayload(message?: string) {
  const storageState = await artShowWatchStorageState();
  if (!storageState.ready) {
    return {
      storageReady: false,
      message: message ?? storageState.message,
      usage: await getUsageState(artShowUsageService),
      watchTerms: [],
      leads: [],
      savedLeads: []
    };
  }

  const staleCutoff = new Date(Date.now() - artShowSearchTimeoutMs).toISOString();
  await expireStaleArtShowSearchBatches(staleCutoff);
  await expireStaleArtShowSearchRunsWithoutBatches(staleCutoff);
  const activeRun = await getActiveArtShowSearchRun();
  if (activeRun) await summarizeArtShowSearchRun(activeRun.id);
  const searchRun = (await getActiveArtShowSearchRun()) ?? (await getLatestArtShowSearchRun());

  return {
    storageReady: true,
    message,
    usage: await getUsageState(artShowUsageService),
    watchTerms: await listArtWatchTermsWithSeed(),
    leads: await listArtShowLeads("new"),
    savedLeads: await listArtShowLeads("saved"),
    searchRun,
    searchProgress: await getArtShowSearchProgress(searchRun)
  };
}

async function processNextArtShowBatch() {
  const activeRun = await getActiveArtShowSearchRun();
  if (!activeRun) return artShowsPayload("No active art show search is running.");

  const batch = await claimNextArtShowSearchBatch(activeRun.id);
  if (!batch) {
    await summarizeArtShowSearchRun(activeRun.id);
    return artShowsPayload("No pending art show batches remain.");
  }

  const reservation = await tryReserveChecks(1, artShowUsageService);
  if (reservation.allowed < 1) {
    await updateArtShowSearchBatch(batch.id, {
      status: "error",
      resultCount: 0,
      message: "Daily controlled search cap reached. Retry will continue with remaining names."
    });
    await updateArtShowSearchRun(activeRun.id, {
      status: "error",
      resultCount: activeRun.resultCount,
      message: "Daily controlled search cap reached. Start a new sweep later to continue remaining names."
    });
    return {
      ...(await artShowsPayload("Daily controlled search cap reached. Existing show leads are still shown.")),
      usage: reservation.usage
    };
  }

  try {
    const result = await findArtShowsWithSerpApi(batch.termLabels);
    if (!result.leads.length) {
      await markArtWatchTermsSearched(batch.termLabels);
      await updateArtShowSearchBatch(batch.id, {
        status: "complete",
        resultCount: 0,
        message: "No useful source candidates found for this batch."
      });
      await summarizeArtShowSearchRun(activeRun.id);
      return artShowsPayload("Batch complete. No useful source candidates found.");
    }

    const saved = await writeArtShowLeads(result.leads);
    if (saved) await markArtWatchTermsSearched(batch.termLabels);
    await updateArtShowSearchBatch(batch.id, {
      status: saved ? "complete" : "error",
      resultCount: saved ? result.leads.length : 0,
      message: saved
        ? `Saved ${result.leads.length} sourced show lead${
            result.leads.length === 1 ? "" : "s"
          } for this batch.`
        : "Source candidates were found, but could not be saved. Check the migration and logs."
    });
    await summarizeArtShowSearchRun(activeRun.id);
    return artShowsPayload(
      saved
        ? `Batch complete. Saved ${result.leads.length} sourced show lead${
            result.leads.length === 1 ? "" : "s"
          }.`
        : "Batch finished, but source candidates could not be saved."
    );
  } catch (error) {
    await markArtWatchTermsSearchFailed(batch.termLabels);
    await updateArtShowSearchBatch(batch.id, {
      status: "error",
      resultCount: 0,
      message: artShowSearchErrorMessage(error)
    });
    await summarizeArtShowSearchRun(activeRun.id);
    return artShowsPayload(artShowSearchErrorMessage(error));
  }
}

export async function GET() {
  return NextResponse.json(await artShowsPayload());
}

export async function PUT(request: Request) {
  const storageState = await artShowWatchStorageState();
  if (!storageState.ready) {
    return NextResponse.json(await artShowsPayload(storageState.message), { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const labels = labelsFromText(body?.text ?? "");
  if (!labels.length) {
    return NextResponse.json(await artShowsPayload("Add at least one artist or movement."), {
      status: 400
    });
  }

  const saved = await replaceArtWatchTerms(labels);
  if (!saved) {
    return NextResponse.json(
      await artShowsPayload("Unable to save the art show watchlist. Check D1 logs and retry."),
      { status: 502 }
    );
  }

  return NextResponse.json(await artShowsPayload("Art show watchlist saved."));
}

export async function POST() {
  const storageState = await artShowWatchStorageState();
  if (!storageState.ready) {
    return NextResponse.json(await artShowsPayload(storageState.message), { status: 503 });
  }

  const staleCutoff = new Date(Date.now() - artShowSearchTimeoutMs).toISOString();
  await expireStaleArtShowSearchBatches(staleCutoff);
  await expireStaleArtShowSearchRunsWithoutBatches(staleCutoff);
  const activeRun = await getActiveArtShowSearchRun();
  if (activeRun) {
    return NextResponse.json(await artShowsPayload("Art show search is already running."));
  }

  const watchTerms = await listArtWatchTermsWithSeed();
  const freshCutoff = new Date(
    Date.now() - 1000 * 60 * 60 * 24 * artShowSearchFreshDays
  ).toISOString();
  const failureCutoff = new Date(
    Date.now() - 1000 * 60 * 60 * 24 * artShowSearchFailureCooldownDays
  ).toISOString();
  const dueTerms = watchTerms.filter((term) =>
    artWatchTermIsDue(term, freshCutoff, failureCutoff)
  );
  const artists = dueTerms.map((term) => term.label);

  if (!watchTerms.some((term) => term.active)) {
    return NextResponse.json(await artShowsPayload("Add artists before searching shows."), {
      status: 400
    });
  }

  if (!artists.length) {
    return NextResponse.json(
      await artShowsPayload(
        `All active watchlist names have either completed a show search or hit a timeout cooldown in the last ${artShowSearchFreshDays} days.`
      )
    );
  }

  const run = await createArtShowSearchRun(dueTerms);
  if (!run) {
    return NextResponse.json(
      {
        ...(await artShowsPayload("Unable to start art show search. Check the migration and logs.")),
        usage: await getUsageState(artShowUsageService)
      },
      { status: 500 }
    );
  }

  return NextResponse.json(await artShowsPayload("Art show source search queued."));
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    action?: "process-next-batch";
    id?: string;
    status?: ArtShowLeadStatus;
  } | null;

  if (body?.action === "process-next-batch") {
    return NextResponse.json(await processNextArtShowBatch());
  }

  if (!body?.id || !body.status || !["new", "saved", "hidden"].includes(body.status)) {
    return NextResponse.json(await artShowsPayload("Lead id and status are required."), {
      status: 400
    });
  }

  await updateArtShowLeadStatus(body.id, body.status);
  return NextResponse.json(
    await artShowsPayload(
      body.status === "hidden" ? "Show lead removed from active lists." : "Show lead saved."
    )
  );
}
