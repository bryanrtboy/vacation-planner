import type { Destination, WatchedSearch, WatchRefreshResult } from "@/lib/types";

export type FlightProviderContext = {
  search: WatchedSearch;
  destination: Destination;
};

export type FlightProvider = {
  name: string;
  sourceKind: "live" | "mock";
  sampleFare(context: FlightProviderContext): Promise<WatchRefreshResult>;
};

export type NormalizedFare = {
  min: number;
  max: number;
  currency: "USD";
  offerCount: number;
  sampledDates: string;
  retrievedAt: string;
  sourceUrl?: string;
};
