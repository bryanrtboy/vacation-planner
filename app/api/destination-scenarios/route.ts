import { NextResponse } from "next/server";
import {
  listDestinationScenarios,
  writeDestinationScenario
} from "@/lib/storage/destination-scenario-store";
import {
  defaultTripPreferences,
  minimumFlightCountForLodging,
  normalizeFlightCount
} from "@/lib/trip-preferences";
import type { TripPreferences } from "@/lib/types";

export const runtime = "nodejs";

function normalizeNights(value: unknown) {
  const nights = Number(value);
  return Number.isFinite(nights)
    ? Math.min(Math.max(Math.round(nights), 1), 60)
    : defaultTripPreferences.nights;
}

function normalizePreferences(preferences?: Partial<TripPreferences>): TripPreferences {
  const lodging = preferences?.lodging ?? defaultTripPreferences.lodging;
  return {
    ...defaultTripPreferences,
    ...preferences,
    departure: (preferences?.departure ?? defaultTripPreferences.departure).trim().toUpperCase(),
    travelMode: preferences?.travelMode === "drive" ? "drive" : "fly",
    flightCount: Math.max(
      normalizeFlightCount(preferences?.flightCount),
      minimumFlightCountForLodging(lodging)
    ),
    nights: normalizeNights(preferences?.nights)
  };
}

export async function GET() {
  return NextResponse.json({
    scenarios: await listDestinationScenarios()
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    destinationSlug?: string;
    preferences?: Partial<TripPreferences>;
  } | null;

  const destinationSlug = body?.destinationSlug?.trim();
  if (!destinationSlug) {
    return NextResponse.json({ error: "Destination slug is required." }, { status: 400 });
  }

  const preferences = normalizePreferences(body?.preferences);
  const saved = await writeDestinationScenario(destinationSlug, preferences);

  return NextResponse.json({ saved, scenario: { destinationSlug, preferences } });
}
