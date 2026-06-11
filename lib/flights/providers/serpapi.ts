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

  const sortedTotals = [...totals].sort((first, second) => first - second);
  const min = Math.round(sortedTotals[0]);
  const displayCeiling = min + 250;
  const displayedTotals = sortedTotals.filter((total) => total <= displayCeiling);
  const max = Math.round(displayedTotals.at(-1) ?? sortedTotals[0]);
  const flightSearch = {
    ...context.destination.flightSearch,
    origin: context.search.origin ?? context.destination.flightSearch.origin,
    departDate: context.search.departDate ?? context.destination.flightSearch.departDate,
    returnDate: context.search.returnDate ?? context.destination.flightSearch.returnDate,
    adults: context.search.adults ?? 1
  };
  const sampledDates = `${flightSearch.departDate}-${flightSearch.returnDate}`;

  return {
    min,
    max,
    currency: "USD",
    offerCount: totals.length,
    displayedOfferCount: displayedTotals.length,
    sampledDates,
    retrievedAt: new Date().toISOString(),
    sourceUrl: response.search_metadata?.google_flights_url ?? googleFlightsSearchUrl(flightSearch)
  };
}

function unavailableResult(
  context: FlightProviderContext,
  message: string,
  error?: unknown
): WatchRefreshResult {
  const errorDetail = error instanceof Error ? ` ${error.message}` : "";
  const flightSearch = {
    ...context.destination.flightSearch,
    origin: context.search.origin ?? context.destination.flightSearch.origin,
    departDate: context.search.departDate ?? context.destination.flightSearch.departDate,
    returnDate: context.search.returnDate ?? context.destination.flightSearch.returnDate,
    adults: context.search.adults ?? 1
  };
  const sourceUrl = googleFlightsSearchUrl(flightSearch);

  return {
    id: context.search.id,
    destinationSlug: context.search.destinationSlug,
    destinationName: context.search.destinationName,
    status: "error",
    message: `${message}${errorDetail}`,
    provider: "SerpApi Google Flights",
    previousRange: context.search.lastRange,
    sampledDates: `${flightSearch.departDate}-${flightSearch.returnDate}`,
    retrievedAt: new Date().toISOString(),
    sourceUrl,
    sourceDetail:
      "The live airfare provider did not return a usable Google Flights price for this route/date search.",
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

  const flightSearch = {
    ...context.destination.flightSearch,
    origin: context.search.origin ?? context.destination.flightSearch.origin,
    departDate: context.search.departDate ?? context.destination.flightSearch.departDate,
    returnDate: context.search.returnDate ?? context.destination.flightSearch.returnDate,
    destinationAirports:
      context.search.destinationAirports ?? context.destination.flightSearch.destinationAirports
  };
  const params = new URLSearchParams({
    engine: "google_flights",
    api_key: key,
    type: "1",
    travel_class: "1",
    deep_search: "true",
    show_hidden: "true",
    sort_by: "2",
    departure_id: flightSearch.origin,
    arrival_id: flightSearch.destinationAirports[0] ?? flightSearch.destination,
    outbound_date: flightSearch.departDate,
    return_date: flightSearch.returnDate,
    currency: "USD",
    hl: "en",
    gl: "us",
    adults: String(context.search.adults ?? 1)
  });
  const ticketCount = context.search.adults ?? 1;

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
      } via SerpApi for ${context.search.route} (${ticketCount} ${
        ticketCount === 1 ? "ticket" : "tickets"
      }); displayed range uses the lowest ${fare.displayedOfferCount}.`,
      provider: "SerpApi Google Flights",
      previousRange: context.search.lastRange,
      currentRange: { min: fare.min, max: fare.max },
      sampledDates: fare.sampledDates,
      retrievedAt: fare.retrievedAt,
      sourceUrl: fare.sourceUrl,
      sourceDetail:
        "Live airfare sampled from SerpApi Google Flights deep search. The displayed range uses the lowest fare cluster and excludes much higher outliers.",
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
