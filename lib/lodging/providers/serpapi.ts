import { googleHotelsSearchUrl } from "@/lib/lodging/links";
import { lodgingSearchQuery, type LodgingMode } from "@/lib/lodging/modes";
import type { Destination, TripWindow, WatchRefreshResult } from "@/lib/types";

const serpApiEndpoint = "https://serpapi.com/search";

type SerpApiRate = {
  extracted_lowest?: number;
  extracted_before_taxes_fees?: number;
};

type SerpApiHotelProperty = {
  name?: string;
  link?: string;
  price?: string;
  extracted_price?: number;
  rate_per_night?: SerpApiRate;
  total_rate?: SerpApiRate;
};

type SerpApiHotelsResponse = {
  properties?: SerpApiHotelProperty[];
  search_metadata?: {
    google_hotels_url?: string;
  };
  error?: string;
};

export type LodgingSearchContext = {
  destination: Destination;
  mode: LodgingMode;
  tripWindow: TripWindow;
};

function apiKey() {
  return process.env.SERPAPI_API_KEY;
}

function nightsBetween(tripWindow: TripWindow) {
  const start = new Date(`${tripWindow.departDate}T00:00:00Z`).getTime();
  const end = new Date(`${tripWindow.returnDate}T00:00:00Z`).getTime();
  const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Number.isFinite(nights) && nights > 0 ? nights : 1;
}

function numericRate(...values: unknown[]) {
  return values.find(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0
  );
}

function totalRate(property: SerpApiHotelProperty, nights: number) {
  const total = numericRate(
    property.total_rate?.extracted_lowest,
    property.total_rate?.extracted_before_taxes_fees
  );
  const nightly = numericRate(
    property.rate_per_night?.extracted_lowest,
    property.rate_per_night?.extracted_before_taxes_fees,
    property.extracted_price
  );

  if (typeof total === "number") {
    if (typeof nightly === "number") {
      const nightlyTotal = nightly * nights;
      if (total < nightlyTotal * 0.75) return nightlyTotal;
    }

    return total;
  }

  if (typeof nightly === "number") {
    return nightly * nights;
  }

  return null;
}

function unavailableResult(
  context: LodgingSearchContext,
  message: string,
  error?: unknown
): WatchRefreshResult {
  const errorDetail = error instanceof Error ? ` ${error.message}` : "";

  return {
    id: `${context.destination.slug}-${context.mode.id}-lodging`,
    destinationSlug: context.destination.slug,
    destinationName: context.destination.name,
    status: "error",
    message: `${message}${errorDetail}`,
    provider: "SerpApi Google Hotels",
    sampledDates: `${context.tripWindow.departDate}-${context.tripWindow.returnDate}`,
    retrievedAt: new Date().toISOString(),
    sourceUrl: googleHotelsSearchUrl(context.destination, context.tripWindow, context.mode),
    sourceDetail:
      "The lodging check did not return a usable Google Hotels price for this stay search.",
    sourceKind: "unavailable"
  };
}

function normalizeLodging(
  data: SerpApiHotelsResponse,
  context: LodgingSearchContext
): WatchRefreshResult | null {
  const nights = nightsBetween(context.tripWindow);
  const totals = (data.properties ?? [])
    .map((property) => totalRate(property, nights))
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price > 0)
    .sort((first, second) => first - second);

  if (!totals.length) return null;

  const min = Math.round(totals[0]);
  const displayCeiling = min + Math.max(250, Math.round(min * 0.35));
  const displayedTotals = totals.filter((total) => total <= displayCeiling);
  const max = Math.round(displayedTotals.at(-1) ?? totals[0]);

  return {
    id: `${context.destination.slug}-${context.mode.id}-lodging`,
    destinationSlug: context.destination.slug,
    destinationName: context.destination.name,
    status: "checked",
    message: `Google Hotels ${context.mode.label.toLowerCase()} pricing checked ${
      totals.length
    } result${totals.length === 1 ? "" : "s"}; displayed range uses the lowest ${
      displayedTotals.length
    }.`,
    provider: "SerpApi Google Hotels",
    currentRange: { min, max },
    sampledDates: `${context.tripWindow.departDate}-${context.tripWindow.returnDate}`,
    retrievedAt: new Date().toISOString(),
    sourceUrl:
      data.search_metadata?.google_hotels_url ??
      googleHotelsSearchUrl(context.destination, context.tripWindow, context.mode),
    sourceDetail:
      "Lodging checked through Google Hotels. Total-stay prices are cross-checked against nightly rates when both are returned, then summarized as the lowest plausible price cluster before detailed property review.",
    sourceKind: "live"
  };
}

export async function sampleSerpApiLodging(
  context: LodgingSearchContext
): Promise<WatchRefreshResult> {
  const key = apiKey();
  if (!key) return unavailableResult(context, "Lodging checks are not configured yet.");

  const params = new URLSearchParams({
    engine: "google_hotels",
    api_key: key,
    q: lodgingSearchQuery(context.destination, context.mode),
    check_in_date: context.tripWindow.departDate,
    check_out_date: context.tripWindow.returnDate,
    adults: String(context.mode.adults),
    children: "0",
    currency: "USD",
    hl: "en",
    gl: "us",
    sort_by: "3"
  });

  if (context.mode.vacationRental) {
    params.set("vacation_rentals", "true");
  } else {
    params.set("hotel_class", "3,4");
  }

  try {
    const response = await fetch(`${serpApiEndpoint}?${params.toString()}`);
    const data = (await response.json().catch(() => ({}))) as SerpApiHotelsResponse;

    if (!response.ok) {
      return unavailableResult(context, data.error ?? `Lodging check returned ${response.status}.`);
    }

    if (data.error) return unavailableResult(context, data.error);

    const lodging = normalizeLodging(data, context);
    if (!lodging) {
      return unavailableResult(
        context,
        `No Google Hotels prices were returned for ${context.mode.label.toLowerCase()}.`
      );
    }

    return lodging;
  } catch (error) {
    return unavailableResult(context, "Unable to check Google Hotels prices.", error);
  }
}
