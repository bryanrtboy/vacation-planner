import { NextResponse } from "next/server";
import { findArtShowsWithGemini } from "@/lib/ai/gemini";
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
  releaseReservedChecks,
  tryReserveChecks
} from "@/lib/price-watch/usage-store";
import type { ArtShowLeadStatus } from "@/lib/types";

export const runtime = "nodejs";

const aiUsageService = "ai";
const artShowSearchTimeoutMs = 1000 * 60 * 2;
const artShowSearchFreshDays = 30;

function labelsFromText(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80);
}

function artWatchTermIsDue(term: { active: boolean; lastSearchedAt?: string }, cutoffIso: string) {
  return term.active && (!term.lastSearchedAt || term.lastSearchedAt < cutoffIso);
}

function artShowSearchErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to search art shows right now.";
  const normalized = message.toLowerCase();

  if (normalized.includes("quota") || normalized.includes("rate limit")) {
    return [
      "Gemini could not run the art show search because the Google API quota for this request is unavailable.",
      "This is separate from the app's daily search cap. Check the Gemini API key, billing/quota, and whether Google Search grounding is available for the configured model."
    ].join(" ");
  }

  if (normalized.includes("api key")) {
    return "Gemini API key is missing or unavailable in Cloudflare. Add GEMINI_API_KEY as a Cloudflare secret before searching shows.";
  }

  if (normalized.includes("abort") || normalized.includes("timeout")) {
    return "Art show search timed out before Gemini returned sourced leads. Try again later or search after trimming the watchlist.";
  }

  return message;
}

async function artShowsPayload(message?: string) {
  const storageState = await artShowWatchStorageState();
  if (!storageState.ready) {
    return {
      storageReady: false,
      message: message ?? storageState.message,
      usage: await getUsageState(aiUsageService),
      watchTerms: [],
      leads: []
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
    usage: await getUsageState(aiUsageService),
    watchTerms: await listArtWatchTermsWithSeed(),
    leads: await listArtShowLeads("new"),
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

  const reservation = await tryReserveChecks(1, aiUsageService);
  if (reservation.allowed < 1) {
    await updateArtShowSearchBatch(batch.id, {
      status: "error",
      resultCount: 0,
      message: "Daily AI search cap reached. Retry will continue with remaining names."
    });
    await updateArtShowSearchRun(activeRun.id, {
      status: "error",
      resultCount: activeRun.resultCount,
      message: "Daily AI search cap reached. Start a new sweep later to continue remaining names."
    });
    return {
      ...(await artShowsPayload("Daily AI search cap reached. Existing show leads are still shown.")),
      usage: reservation.usage
    };
  }

  try {
    const result = await findArtShowsWithGemini(batch.termLabels);
    if (!result.leads.length) {
      await markArtWatchTermsSearched(batch.termLabels);
      await updateArtShowSearchBatch(batch.id, {
        status: "complete",
        resultCount: 0,
        message: "No high-confidence show leads found for this batch."
      });
      await summarizeArtShowSearchRun(activeRun.id);
      return artShowsPayload("Batch complete. No high-confidence show leads found.");
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
        : "Show leads were found, but could not be saved. Check the migration and logs."
    });
    await summarizeArtShowSearchRun(activeRun.id);
    return artShowsPayload(
      saved
        ? `Batch complete. Saved ${result.leads.length} sourced show lead${
            result.leads.length === 1 ? "" : "s"
          }.`
        : "Batch finished, but show leads could not be saved."
    );
  } catch (error) {
    await releaseReservedChecks(reservation.allowed, aiUsageService);
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

  await replaceArtWatchTerms(labels);
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
  const dueTerms = watchTerms.filter((term) => artWatchTermIsDue(term, freshCutoff));
  const artists = dueTerms.map((term) => term.label);

  if (!watchTerms.some((term) => term.active)) {
    return NextResponse.json(await artShowsPayload("Add artists before searching shows."), {
      status: 400
    });
  }

  if (!artists.length) {
    return NextResponse.json(
      await artShowsPayload(
        `All active watchlist names have completed a show search in the last ${artShowSearchFreshDays} days.`
      )
    );
  }

  const run = await createArtShowSearchRun(dueTerms);
  if (!run) {
    return NextResponse.json(
      {
        ...(await artShowsPayload("Unable to start art show search. Check the migration and logs.")),
        usage: await getUsageState(aiUsageService)
      },
      { status: 500 }
    );
  }

  return NextResponse.json(await artShowsPayload("Art show search queued."));
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
    await artShowsPayload(body.status === "hidden" ? "Show lead hidden." : "Show lead saved.")
  );
}
