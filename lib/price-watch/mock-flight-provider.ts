import { getDestination } from "@/lib/seed-data";
import type { WatchedSearch, WatchRefreshResult } from "@/lib/types";

function stableDelta(id: string) {
  const total = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (total % 7) * 20 - 60;
}

export async function sampleWatchedFare(search: WatchedSearch): Promise<WatchRefreshResult> {
  const destination = getDestination(search.destinationSlug);
  const base = destination?.airfare;

  if (!base) {
    return {
      id: search.id,
      destinationSlug: search.destinationSlug,
      destinationName: search.destinationName,
      status: "error",
      message: "No seeded fare profile exists for this watched search.",
      sourceKind: "unavailable"
    };
  }

  const delta = stableDelta(`${search.id}-${new Date().toISOString().slice(0, 10)}`);
  const currentRange = {
    min: Math.max(base.min + delta, 0),
    max: Math.max(base.max + delta, base.min + delta + 120)
  };
  const previousRange = search.lastRange ?? { min: base.min + 80, max: base.max + 80 };
  const midpointChange =
    (currentRange.min + currentRange.max) / 2 - (previousRange.min + previousRange.max) / 2;
  const direction = midpointChange < -75 ? "dropped" : midpointChange > 75 ? "rose" : "held steady";

  return {
    id: search.id,
    destinationSlug: search.destinationSlug,
    destinationName: search.destinationName,
    status: "checked",
    message: `Mock airfare ${direction} for ${search.route}. Replace this provider with live airfare before relying on prices.`,
    previousRange,
    currentRange,
    sampledDates: base.sampledDates,
    retrievedAt: new Date().toISOString(),
    sourceKind: "mock"
  };
}
