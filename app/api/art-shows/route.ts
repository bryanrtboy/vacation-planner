import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { findArtShowsWithGemini } from "@/lib/ai/gemini";
import {
  artShowWatchStorageState,
  createArtShowSearchRun,
  expireStaleArtShowSearchRuns,
  getActiveArtShowSearchRun,
  getLatestArtShowSearchRun,
  listArtShowLeads,
  listArtWatchTermsWithSeed,
  markActiveArtWatchTermsSearched,
  replaceArtWatchTerms,
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

function labelsFromText(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80);
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

  await expireStaleArtShowSearchRuns(
    new Date(Date.now() - artShowSearchTimeoutMs).toISOString()
  );

  return {
    storageReady: true,
    message,
    usage: await getUsageState(aiUsageService),
    watchTerms: await listArtWatchTermsWithSeed(),
    leads: await listArtShowLeads("new"),
    searchRun: (await getActiveArtShowSearchRun()) ?? (await getLatestArtShowSearchRun())
  };
}

async function completeArtShowSearchRun(
  runId: string,
  artists: string[],
  reservedChecks: number
) {
  try {
    const result = await findArtShowsWithGemini(artists);
    if (!result.leads.length) {
      await markActiveArtWatchTermsSearched();
      await updateArtShowSearchRun(runId, {
        status: "complete",
        resultCount: 0,
        message: "No high-confidence show leads found in this search."
      });
      return;
    }

    const saved = await writeArtShowLeads(result.leads);
    if (saved) await markActiveArtWatchTermsSearched();
    await updateArtShowSearchRun(runId, {
      status: saved ? "complete" : "error",
      resultCount: saved ? result.leads.length : 0,
      message: saved
        ? `Saved ${result.leads.length} sourced show lead${
            result.leads.length === 1 ? "" : "s"
          }.`
        : "Show leads were found, but could not be saved. Check the migration and logs."
    });
  } catch (error) {
    await releaseReservedChecks(reservedChecks, aiUsageService);
    await updateArtShowSearchRun(runId, {
      status: "error",
      resultCount: 0,
      message: artShowSearchErrorMessage(error)
    });
  }
}

function runAfterResponse(task: Promise<void>) {
  try {
    getCloudflareContext().ctx.waitUntil(task);
  } catch {
    void task;
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

  await expireStaleArtShowSearchRuns(
    new Date(Date.now() - artShowSearchTimeoutMs).toISOString()
  );
  const activeRun = await getActiveArtShowSearchRun();
  if (activeRun) {
    return NextResponse.json(await artShowsPayload("Art show search is already running."));
  }

  const artists = (await listArtWatchTermsWithSeed()).filter((term) => term.active).map((term) => term.label);

  if (!artists.length) {
    return NextResponse.json(await artShowsPayload("Add artists before searching shows."), {
      status: 400
    });
  }

  const reservation = await tryReserveChecks(1, aiUsageService);
  if (reservation.allowed < 1) {
    return NextResponse.json(
      {
        ...(await artShowsPayload("Daily AI search cap reached. Existing show leads are still shown.")),
        usage: reservation.usage
      },
      { status: 429 }
    );
  }

  const run = await createArtShowSearchRun(artists.length);
  if (!run) {
    const usage = await releaseReservedChecks(reservation.allowed, aiUsageService);
    return NextResponse.json(
      {
        ...(await artShowsPayload("Unable to start art show search. Check the migration and logs.")),
        usage
      },
      { status: 500 }
    );
  }

  runAfterResponse(completeArtShowSearchRun(run.id, artists, reservation.allowed));
  return NextResponse.json(await artShowsPayload("Art show search started."));
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: ArtShowLeadStatus;
  } | null;

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
