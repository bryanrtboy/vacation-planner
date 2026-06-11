import { getDestination } from "@/lib/seed-data";
import { mockFlightProvider } from "@/lib/flights/providers/mock";
import { hasSerpApiKey, serpApiFlightProvider } from "@/lib/flights/providers/serpapi";
import type { FlightProvider } from "@/lib/flights/types";
import type { Destination, WatchedSearch, WatchRefreshResult } from "@/lib/types";

function selectedFlightProvider(): FlightProvider {
  if (hasSerpApiKey()) return serpApiFlightProvider;
  return mockFlightProvider;
}

export async function sampleWatchedFare(search: WatchedSearch): Promise<WatchRefreshResult> {
  const destination = getDestination(search.destinationSlug);

  if (!destination) {
    return {
      id: search.id,
      destinationSlug: search.destinationSlug,
      destinationName: search.destinationName,
      status: "error",
      message: "No seeded destination exists for this watched search.",
      sourceKind: "unavailable"
    };
  }

  const provider = selectedFlightProvider();
  return provider.sampleFare({ search, destination });
}

export async function sampleWatchedFareForDestination(
  search: WatchedSearch,
  destination: Destination
): Promise<WatchRefreshResult> {
  const provider = selectedFlightProvider();
  return provider.sampleFare({ search, destination });
}
