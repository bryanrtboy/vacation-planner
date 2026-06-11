import { NextResponse } from "next/server";
import { lodgingModeFromPreference } from "@/lib/lodging/modes";
import { sampleSerpApiLodging } from "@/lib/lodging/providers/serpapi";
import { getUsageState, tryReserveChecks } from "@/lib/price-watch/usage-store";
import { listDestinationCandidates } from "@/lib/storage/destination-store";
import {
  readPriceSnapshot,
  writePriceSnapshot
} from "@/lib/storage/price-snapshot-store";
import { lodgingSnapshotSearch } from "@/lib/storage/snapshot-keys";
import {
  defaultTripPreferences,
  minimumFlightCountForLodging,
  normalizeFlightCount,
  recommendedTripWindow
} from "@/lib/trip-preferences";
import type { Destination, TripPreferences, WatchRefreshResult } from "@/lib/types";

export const runtime = "nodejs";

const lodgingUsageService = "serpapi";

function normalizePreferences(preferences?: Partial<TripPreferences>): TripPreferences {
  const nights = Number(preferences?.nights);
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
    nights: Number.isFinite(nights)
      ? Math.min(Math.max(Math.round(nights), 1), 60)
      : defaultTripPreferences.nights
  };
}

function cappedResult(destination: Destination): WatchRefreshResult {
  return {
    id: `${destination.slug}-lodging-capped`,
    destinationSlug: destination.slug,
    destinationName: destination.name,
    status: "capped",
    message: "Daily lodging check cap reached. Cached or estimated lodging is still shown.",
    retrievedAt: new Date().toISOString(),
    sourceKind: "unavailable"
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    preferences?: Partial<TripPreferences>;
    refresh?: boolean;
    slugs?: string[];
  } | null;
  const preferences = normalizePreferences(body?.preferences);
  const shouldRefresh = body?.refresh === true;
  const mode = lodgingModeFromPreference(preferences.lodging);
  const destinations = await listDestinationCandidates();
  const destinationBySlug = new Map(destinations.map((destination) => [destination.slug, destination]));
  const requestedSlugs = body?.slugs?.length
    ? body.slugs
    : destinations.map((destination) => destination.slug);
  const uniqueSlugs = [...new Set(requestedSlugs)];
  const contexts = uniqueSlugs
    .map((slug) => destinationBySlug.get(slug))
    .filter((destination): destination is Destination => Boolean(destination))
    .map((destination) => {
      const tripWindow = recommendedTripWindow(destination, preferences);
      return {
        destination,
        mode,
        tripWindow,
        snapshotSearch: lodgingSnapshotSearch(destination, tripWindow, mode)
      };
    });
  const cachedPairs = await Promise.all(
    contexts.map(async (context) => ({
      context,
      result: await readPriceSnapshot(context.snapshotSearch)
    }))
  );
  const cachedResults = cachedPairs
    .map((pair) => pair.result)
    .filter((result): result is WatchRefreshResult => Boolean(result));

  if (!shouldRefresh) {
    return NextResponse.json({
      usage: await getUsageState(lodgingUsageService),
      results: cachedResults
    });
  }

  const reservation = await tryReserveChecks(contexts.length, lodgingUsageService);
  const allowedContexts = contexts.slice(0, reservation.allowed);
  const cappedContexts = contexts.slice(reservation.allowed);

  const checkedResults = await Promise.all(allowedContexts.map(sampleSerpApiLodging));
  await Promise.all(
    checkedResults.map((result, index) =>
      writePriceSnapshot(allowedContexts[index].snapshotSearch, result)
    )
  );

  const cachedBySlug = new Map(
    cachedPairs
      .filter((pair) => pair.result)
      .map((pair) => [pair.context.destination.slug, pair.result as WatchRefreshResult])
  );
  const cappedResults = cappedContexts.map((context) => {
    const cached = cachedBySlug.get(context.destination.slug);
    return cached
      ? {
          ...cached,
          message: "Daily lodging check cap reached. Showing the saved lodging quote from a previous check."
        }
      : cappedResult(context.destination);
  });

  return NextResponse.json({
    usage: await getUsageState(lodgingUsageService),
    results: [...checkedResults, ...cappedResults]
  });
}
