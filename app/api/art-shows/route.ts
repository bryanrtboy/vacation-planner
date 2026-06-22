import { NextResponse } from "next/server";
import { findArtShowsWithGemini } from "@/lib/ai/gemini";
import {
  artShowWatchStorageState,
  ensureSeedArtWatchTerms,
  listArtShowLeads,
  listArtWatchTerms,
  replaceArtWatchTerms,
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

function labelsFromText(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80);
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

  await ensureSeedArtWatchTerms();

  return {
    storageReady: true,
    message,
    usage: await getUsageState(aiUsageService),
    watchTerms: await listArtWatchTerms(),
    leads: await listArtShowLeads("new")
  };
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

  await ensureSeedArtWatchTerms();
  const artists = (await listArtWatchTerms()).filter((term) => term.active).map((term) => term.label);

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

  try {
    const result = await findArtShowsWithGemini(artists);
    if (!result.leads.length) {
      return NextResponse.json(
        await artShowsPayload("No high-confidence show leads found in this search.")
      );
    }

    const saved = await writeArtShowLeads(result.leads);
    return NextResponse.json(
      await artShowsPayload(
        saved
          ? `Saved ${result.leads.length} sourced show lead${
              result.leads.length === 1 ? "" : "s"
            }.`
          : "Show leads were found, but could not be saved. Check the migration and logs."
      )
    );
  } catch (error) {
    const usage = await releaseReservedChecks(reservation.allowed, aiUsageService);
    return NextResponse.json(
      {
        ...(await artShowsPayload(
          error instanceof Error ? error.message : "Unable to search art shows right now."
        )),
        usage
      },
      { status: 502 }
    );
  }
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
