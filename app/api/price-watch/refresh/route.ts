import { NextResponse } from "next/server";
import { sampleWatchedFare } from "@/lib/flights/provider";
import { getUsageState, tryReserveChecks } from "@/lib/price-watch/usage-store";
import { WATCH_MAX_DESTINATIONS, WATCH_REFRESH_STALE_HOURS } from "@/lib/settings";
import type { WatchedSearch, WatchRefreshResult } from "@/lib/types";

export const runtime = "nodejs";

function isStale(lastCheckedAt?: string) {
  if (!lastCheckedAt) return true;
  const checkedAt = new Date(lastCheckedAt).getTime();
  if (Number.isNaN(checkedAt)) return true;
  const ageHours = (Date.now() - checkedAt) / (1000 * 60 * 60);
  return ageHours >= WATCH_REFRESH_STALE_HOURS;
}

export async function GET() {
  return NextResponse.json({
    usage: getUsageState(),
    staleAfterHours: WATCH_REFRESH_STALE_HOURS,
    maxWatchedDestinations: WATCH_MAX_DESTINATIONS
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { searches?: WatchedSearch[] } | null;
  const searches = body?.searches?.slice(0, WATCH_MAX_DESTINATIONS) ?? [];
  const staleSearches = searches.filter((search) => isStale(search.lastCheckedAt));
  const skippedSearches = searches.filter((search) => !isStale(search.lastCheckedAt));
  const reservation = tryReserveChecks(staleSearches.length);
  const allowedSearches = staleSearches.slice(0, reservation.allowed);
  const cappedSearches = staleSearches.slice(reservation.allowed);

  const checkedResults = await Promise.all(allowedSearches.map((search) => sampleWatchedFare(search)));

  const skippedResults: WatchRefreshResult[] = skippedSearches.map((search) => ({
    id: search.id,
    destinationSlug: search.destinationSlug,
    destinationName: search.destinationName,
    status: "skipped",
    message: `Skipped because this watch was checked less than ${WATCH_REFRESH_STALE_HOURS} hours ago.`,
    previousRange: search.lastRange,
    currentRange: search.lastRange,
    retrievedAt: search.lastCheckedAt,
    sourceKind: "cached"
  }));

  const cappedResults: WatchRefreshResult[] = cappedSearches.map((search) => ({
    id: search.id,
    destinationSlug: search.destinationSlug,
    destinationName: search.destinationName,
    status: "capped",
    message: "Daily airfare check cap reached. Try again tomorrow or raise WATCH_DAILY_CAP.",
    previousRange: search.lastRange,
    sourceKind: "unavailable"
  }));

  return NextResponse.json({
    usage: getUsageState(),
    staleAfterHours: WATCH_REFRESH_STALE_HOURS,
    maxWatchedDestinations: WATCH_MAX_DESTINATIONS,
    results: [...checkedResults, ...skippedResults, ...cappedResults]
  });
}
