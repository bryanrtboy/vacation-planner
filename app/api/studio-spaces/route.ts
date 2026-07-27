import { NextResponse } from "next/server";
import { getUsageState, tryReserveChecks } from "@/lib/price-watch/usage-store";
import { findStudioSpacesWithSerpApi } from "@/lib/studio-spaces/serpapi";
import { fetchTransArtistsStudioSpaces } from "@/lib/studio-spaces/transartists";
import {
  listStudioSpaceLeads,
  studioSpaceStorageState,
  updateStudioSpaceLeadStatus,
  writeStudioSpaceLeads
} from "@/lib/storage/studio-space-store";
import type { StudioSpaceLeadStatus } from "@/lib/types";

export const runtime = "nodejs";

const studioSpaceUsageService = "serpapi";

function studioSpaceErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to refresh studio spaces right now.";
  const normalized = message.toLowerCase();

  if (normalized.includes("quota") || normalized.includes("rate limit")) {
    return "The studio space search could not run because source-check quota is unavailable.";
  }

  if (normalized.includes("api key") || normalized.includes("serpapi key")) {
    return "SerpAPI key is missing or unavailable in Cloudflare. TransArtists refresh still works without it.";
  }

  if (normalized.includes("transartists")) return message;
  if (normalized.includes("abort") || normalized.includes("timeout")) {
    return "Studio space source search timed out before results returned.";
  }

  return message;
}

async function studioSpacesPayload(message?: string) {
  const storageState = await studioSpaceStorageState();
  const usage = await getUsageState(studioSpaceUsageService);

  if (!storageState.ready) {
    return {
      storageReady: false,
      message: message ?? storageState.message,
      usage,
      leads: [],
      savedLeads: [],
      hiddenLeads: []
    };
  }

  return {
    storageReady: true,
    message,
    usage,
    leads: await listStudioSpaceLeads("new"),
    savedLeads: await listStudioSpaceLeads("saved"),
    hiddenLeads: await listStudioSpaceLeads("hidden")
  };
}

export async function GET() {
  return NextResponse.json(await studioSpacesPayload());
}

export async function POST() {
  const storageState = await studioSpaceStorageState();
  if (!storageState.ready) {
    return NextResponse.json(await studioSpacesPayload(storageState.message), { status: 503 });
  }

  try {
    const leads = await fetchTransArtistsStudioSpaces();
    const saved = await writeStudioSpaceLeads(leads);
    return NextResponse.json(
      await studioSpacesPayload(
        saved
          ? `Refreshed TransArtists and found ${leads.length} studio lead${
              leads.length === 1 ? "" : "s"
            }.`
          : "TransArtists leads were found, but could not be saved. Check the migration and logs."
      ),
      { status: saved ? 200 : 502 }
    );
  } catch (error) {
    return NextResponse.json(await studioSpacesPayload(studioSpaceErrorMessage(error)), {
      status: 502
    });
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    action?: "search-city";
    city?: string;
    id?: string;
    status?: StudioSpaceLeadStatus;
  } | null;

  const storageState = await studioSpaceStorageState();
  if (!storageState.ready) {
    return NextResponse.json(await studioSpacesPayload(storageState.message), { status: 503 });
  }

  if (body?.action === "search-city") {
    const city = body.city?.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!city) {
      return NextResponse.json(await studioSpacesPayload("Choose a city before searching studio spaces."), {
        status: 400
      });
    }

    const reservation = await tryReserveChecks(1, studioSpaceUsageService);
    if (reservation.allowed < 1) {
      return NextResponse.json({
        ...(await studioSpacesPayload("Daily controlled source-check cap reached. Existing studio leads are still shown.")),
        usage: reservation.usage
      });
    }

    try {
      const result = await findStudioSpacesWithSerpApi(city);
      const saved = await writeStudioSpaceLeads(result.leads);
      return NextResponse.json({
        ...(await studioSpacesPayload(
          saved
            ? `Searched ${city} and saved ${result.leads.length} studio lead${
                result.leads.length === 1 ? "" : "s"
              }.`
            : "Studio candidates were found, but could not be saved. Check the migration and logs."
        )),
        usage: await getUsageState(studioSpaceUsageService)
      });
    } catch (error) {
      return NextResponse.json({
        ...(await studioSpacesPayload(studioSpaceErrorMessage(error))),
        usage: await getUsageState(studioSpaceUsageService)
      }, { status: 502 });
    }
  }

  if (!body?.id || !body.status || !["new", "saved", "hidden"].includes(body.status)) {
    return NextResponse.json(await studioSpacesPayload("Lead id and status are required."), {
      status: 400
    });
  }

  await updateStudioSpaceLeadStatus(body.id, body.status);
  return NextResponse.json(
    await studioSpacesPayload(
      body.status === "hidden" ? "Studio lead removed from active lists." : "Studio lead saved."
    )
  );
}
