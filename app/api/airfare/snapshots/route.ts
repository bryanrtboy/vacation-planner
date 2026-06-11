import { NextResponse } from "next/server";
import { sampleWatchedFare } from "@/lib/flights/provider";
import { destinations, getDestination } from "@/lib/seed-data";
import { getUsageState, tryReserveChecks } from "@/lib/price-watch/usage-store";
import {
  readPriceSnapshot,
  writePriceSnapshot
} from "@/lib/storage/price-snapshot-store";
import { airfareSnapshotSearch } from "@/lib/storage/snapshot-keys";
import {
  defaultTripPreferences,
  minimumFlightCountForLodging,
  normalizeFlightCount,
  recommendedTripWindow
} from "@/lib/trip-preferences";
import type { TripPreferences, WatchedSearch, WatchRefreshResult } from "@/lib/types";

export const runtime = "nodejs";

function normalizePreferences(preferences?: Partial<TripPreferences>): TripPreferences {
  const nights = Number(preferences?.nights);
  const lodging = preferences?.lodging ?? defaultTripPreferences.lodging;
  return {
    ...defaultTripPreferences,
    ...preferences,
    departure: (preferences?.departure ?? defaultTripPreferences.departure).trim().toUpperCase(),
    flightCount: Math.max(
      normalizeFlightCount(preferences?.flightCount),
      minimumFlightCountForLodging(lodging)
    ),
    nights: Number.isFinite(nights) ? Math.min(Math.max(Math.round(nights), 1), 60) : defaultTripPreferences.nights
  };
}

function watchedSearchForSlug(slug: string, preferences: TripPreferences): WatchedSearch | null {
  const destination = getDestination(slug);
  if (!destination) return null;
  const tripWindow = recommendedTripWindow(destination, preferences.nights);

  return {
    id: `${destination.slug}-card-snapshot`,
    destinationSlug: destination.slug,
    destinationName: destination.name,
    route: `${preferences.departure} to ${destination.flightSearch.destination}`,
    season: destination.bestMonths,
    tripLength: preferences.nights >= 28 ? "1-month" : "7-nights",
    origin: preferences.departure,
    adults: preferences.flightCount,
    departDate: tripWindow.departDate,
    returnDate: tripWindow.returnDate,
    destinationAirports: destination.flightSearch.destinationAirports
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
  const requestedSlugs = body?.slugs?.length
    ? body.slugs
    : destinations.map((destination) => destination.slug);
  const uniqueSlugs = [...new Set(requestedSlugs)];
  const searches = uniqueSlugs
    .map((slug) => watchedSearchForSlug(slug, preferences))
    .filter((search): search is WatchedSearch => Boolean(search));
  const cachedPairs = await Promise.all(
    searches.map(async (search) => ({
      search,
      result: await readPriceSnapshot(airfareSnapshotSearch(search))
    }))
  );
  const cachedResults = cachedPairs
    .map((pair) => pair.result)
    .filter((result): result is WatchRefreshResult => Boolean(result));

  if (!shouldRefresh) {
    return NextResponse.json({
      usage: await getUsageState(),
      results: cachedResults
    });
  }

  const reservation = await tryReserveChecks(searches.length);
  const allowedSearches = searches.slice(0, reservation.allowed);
  const cappedSearches = searches.slice(reservation.allowed);

  const checkedResults = await Promise.all(allowedSearches.map((search) => sampleWatchedFare(search)));
  await Promise.all(
    checkedResults.map((result, index) =>
      writePriceSnapshot(airfareSnapshotSearch(allowedSearches[index]), result)
    )
  );
  const cachedBySlug = new Map(
    cachedPairs
      .filter((pair) => pair.result)
      .map((pair) => [pair.search.destinationSlug, pair.result as WatchRefreshResult])
  );
  const cappedResults: WatchRefreshResult[] = cappedSearches.map((search) => ({
    ...(cachedBySlug.get(search.destinationSlug) ?? {
      id: search.id,
      destinationSlug: search.destinationSlug,
      destinationName: search.destinationName,
      status: "capped" as const,
      message: "Daily airfare check cap reached. Cached or seeded airfare is still shown.",
      retrievedAt: new Date().toISOString(),
      sourceKind: "unavailable" as const
    }),
    message: cachedBySlug.has(search.destinationSlug)
      ? "Daily airfare check cap reached. Showing the cached durable fare."
      : "Daily airfare check cap reached. Cached or seeded airfare is still shown."
  }));

  return NextResponse.json({
    usage: await getUsageState(),
    results: [...checkedResults, ...cappedResults]
  });
}
