import { googleFlightsSearchUrl } from "@/lib/flights/links";
import type { FlightProviderContext, NormalizedFare } from "@/lib/flights/types";
import type { WatchRefreshResult } from "@/lib/types";

const serpApiEndpoint = "https://serpapi.com/search";

type SerpApiFlightResult = {
  price?: number;
};

type SerpApiGoogleFlightsResponse = {
  best_flights?: SerpApiFlightResult[];
  other_flights?: SerpApiFlightResult[];
  search_metadata?: {
    google_flights_url?: string;
  };
  error?: string;
};

function apiKey() {
  return process.env.SERPAPI_API_KEY;
}

function normalizeFare(
  response: SerpApiGoogleFlightsResponse,
  context: FlightProviderContext
): NormalizedFare | null {
  const offers = [...(response.best_flights ?? []), ...(response.other_flights ?? [])];
  const totals = offers
    .map((offer) => offer.price)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price > 0);

  if (!totals.length) return null;

  const min = Math.round(Math.min(...totals));
  const max = Math.round(Math.max(...totals));
  const sampledDates = `${context.destination.flightSearch.departDate}-${context.destination.flightSearch.returnDate}`;

  return {
    min,
    max,
    currency: "USD",
    offerCount: totals.length,
    sampledDates,
    retrievedAt: new Date().toISOString(),
    sourceUrl: response.search_metadata?.google_flights_url ?? googleFlightsSearchUrl(context.destination.flightSearch)
  };
}

function unavailableResult(
  context: FlightProviderContext,
  message: string,
  error?: unknown
): WatchRefreshResult {
  const errorDetail = error instanceof Error ? ` ${error.message}` : "";

  return {
    id: context.search.id,
    destinationSlug: context.search.destinationSlug,
    destinationName: context.search.destinationName,
    status: "error",
    message: `${message}${errorDetail}`,
    previousRange: context.search.lastRange,
    sourceKind: "unavailable"
  };
}

export function hasSerpApiKey() {
  return Boolean(apiKey());
}

export async function sampleSerpApiFare(
  context: FlightProviderContext
): Promise<WatchRefreshResult> {
  const key = apiKey();
  if (!key) {
    return unavailableResult(context, "SerpApi key is not configured.");
  }

  const { flightSearch } = context.destination;
  const params = new URLSearchParams({
    engine: "google_flights",
    api_key: key,
    type: "1",
    travel_class: "1",
    departure_id: flightSearch.origin,
    arrival_id: flightSearch.destinationAirports[0] ?? flightSearch.destination,
    outbound_date: flightSearch.departDate,
    return_date: flightSearch.returnDate,
    currency: "USD",
    hl: "en",
    gl: "us",
    adults: "1"
  });

  try {
    const response = await fetch(`${serpApiEndpoint}?${params.toString()}`);
    const data = (await response.json().catch(() => ({}))) as SerpApiGoogleFlightsResponse;

    if (!response.ok) {
      return unavailableResult(context, data.error ?? `SerpApi returned ${response.status}.`);
    }

    if (data.error) {
      return unavailableResult(context, data.error);
    }

    const fare = normalizeFare(data, context);
    if (!fare) {
      return unavailableResult(context, `No Google Flights fares were returned for ${context.search.route}.`);
    }

    return {
      id: context.search.id,
      destinationSlug: context.search.destinationSlug,
      destinationName: context.search.destinationName,
      status: "checked",
      message: `Live Google Flights airfare sampled ${fare.offerCount} result${
        fare.offerCount === 1 ? "" : "s"
      } via SerpApi for ${context.search.route}.`,
      provider: "SerpApi Google Flights",
      previousRange: context.search.lastRange,
      currentRange: { min: fare.min, max: fare.max },
      sampledDates: fare.sampledDates,
      retrievedAt: fare.retrievedAt,
      sourceUrl: fare.sourceUrl,
      sourceDetail:
        "Live airfare sampled from SerpApi Google Flights for the seeded route and dates.",
      sourceKind: "live"
    };
  } catch (error) {
    return unavailableResult(context, "Unable to sample SerpApi Google Flights fares.", error);
  }
}

export const serpApiFlightProvider = {
  name: "SerpApi Google Flights",
  sourceKind: "live" as const,
  sampleFare: sampleSerpApiFare
};
