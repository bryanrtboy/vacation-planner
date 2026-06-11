import { NextResponse } from "next/server";
import { sampleWatchedFare } from "@/lib/flights/provider";
import { destinations, getDestination } from "@/lib/seed-data";
import { getUsageState, tryReserveChecks } from "@/lib/price-watch/usage-store";
import { WATCH_REFRESH_STALE_HOURS } from "@/lib/settings";
import type { WatchedSearch, WatchRefreshResult } from "@/lib/types";

export const runtime = "nodejs";

function watchedSearchForSlug(slug: string): WatchedSearch | null {
  const destination = getDestination(slug);
  if (!destination) return null;

  return {
    id: `${destination.slug}-card-snapshot`,
    destinationSlug: destination.slug,
    destinationName: destination.name,
    route: `${destination.flightSearch.origin} to ${destination.flightSearch.destination}`,
    season: destination.bestMonths,
    tripLength: "7-nights"
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { slugs?: string[] } | null;
  const requestedSlugs = body?.slugs?.length
    ? body.slugs
    : destinations.map((destination) => destination.slug);
  const uniqueSlugs = [...new Set(requestedSlugs)];
  const searches = uniqueSlugs
    .map(watchedSearchForSlug)
    .filter((search): search is WatchedSearch => Boolean(search));

  const reservation = tryReserveChecks(searches.length);
  const allowedSearches = searches.slice(0, reservation.allowed);
  const cappedSearches = searches.slice(reservation.allowed);

  const checkedResults = await Promise.all(allowedSearches.map((search) => sampleWatchedFare(search)));
  const cappedResults: WatchRefreshResult[] = cappedSearches.map((search) => ({
    id: search.id,
    destinationSlug: search.destinationSlug,
    destinationName: search.destinationName,
    status: "capped",
    message: "Daily airfare check cap reached. Cached or seeded airfare is still shown.",
    retrievedAt: new Date().toISOString(),
    sourceKind: "unavailable"
  }));

  return NextResponse.json({
    usage: getUsageState(),
    staleAfterHours: WATCH_REFRESH_STALE_HOURS,
    results: [...checkedResults, ...cappedResults]
  });
}
