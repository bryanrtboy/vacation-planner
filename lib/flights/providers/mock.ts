import type { FlightProviderContext } from "@/lib/flights/types";
import type { WatchRefreshResult } from "@/lib/types";

function stableDelta(id: string) {
  const total = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (total % 7) * 20 - 60;
}

export async function sampleMockFare({
  search,
  destination
}: FlightProviderContext): Promise<WatchRefreshResult> {
  const base = destination.airfare;
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
    message: `Mock airfare ${direction} for ${search.route}. Add SERPAPI_API_KEY to use live Google Flights fares.`,
    provider: "Mock flight sampler",
    previousRange,
    currentRange,
    sampledDates: base.sampledDates,
    retrievedAt: new Date().toISOString(),
    sourceUrl: base.sourceUrl,
    sourceDetail: base.sourceDetail,
    sourceKind: "mock"
  };
}

export const mockFlightProvider = {
  name: "Mock flight sampler",
  sourceKind: "mock" as const,
  sampleFare: sampleMockFare
};
