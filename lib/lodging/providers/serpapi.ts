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
  type?: string;
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

type LodgingCandidate = {
  name: string;
  nightly: number;
  total: number;
};

const outdoorLodgingPattern =
  /\b(camp|camping|campsite|tent|rv|yurt|glamping|hostel|dorm|shared room)\b/i;
const hotelBrandPattern =
  /\b(hotel|inn|motel|hilton|hyatt|marriott|sheraton|wyndham|la quinta|holiday inn|quality inn|comfort inn|hampton|home2|candlewood|best western|travelodge|days inn|super 8)\b/i;
const homeRentalPattern =
  /\b(apartment|studio|condo|flat|loft|bungalow|cottage|guesthouse|guest house|house|home|cabin|suite|retreat|townhouse|villa)\b/i;
const groupRentalPattern = /\b(house|home|cottage|cabin|villa|townhouse|retreat|bungalow)\b/i;

function candidateForProperty(property: SerpApiHotelProperty, nights: number): LodgingCandidate | null {
  const total = totalRate(property, nights);
  if (typeof total !== "number") return null;

  const nightly = total / nights;
  if (!Number.isFinite(nightly) || nightly <= 0) return null;

  return {
    name: property.name ?? "Unnamed lodging",
    nightly,
    total
  };
}

function candidateMatchesMode(candidate: LodgingCandidate, mode: LodgingMode) {
  if (outdoorLodgingPattern.test(candidate.name)) return false;

  if (mode.id === "hotel") return !outdoorLodgingPattern.test(candidate.name);
  if (hotelBrandPattern.test(candidate.name)) return false;
  if (mode.id === "group-house") return groupRentalPattern.test(candidate.name);

  return homeRentalPattern.test(candidate.name);
}

function median(values: number[]) {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  if (!sorted.length) return undefined;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function removeLowOutliers(candidates: LodgingCandidate[]) {
  if (candidates.length < 5) return candidates;

  const medianNightly = median(candidates.map((candidate) => candidate.nightly));
  if (typeof medianNightly !== "number") return candidates;

  const floor = medianNightly * 0.6;
  const filtered = candidates.filter((candidate) => candidate.nightly >= floor);
  return filtered.length >= 3 ? filtered : candidates;
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
  const rawCandidates = (data.properties ?? [])
    .map((property) => candidateForProperty(property, nights))
    .filter((candidate): candidate is LodgingCandidate => Boolean(candidate));
  const modeCandidates = rawCandidates.filter((candidate) =>
    candidateMatchesMode(candidate, context.mode)
  );
  const candidates = removeLowOutliers(modeCandidates).sort(
    (first, second) => first.total - second.total
  );
  const totals = candidates.map((candidate) => candidate.total);

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
    sourceDetail:
      `Lodging checked through Google Hotels using exact SerpApi dates. Filtered ${rawCandidates.length} raw result${
        rawCandidates.length === 1 ? "" : "s"
      } to ${modeCandidates.length} ${context.mode.label.toLowerCase()}-compatible result${
        modeCandidates.length === 1 ? "" : "s"
      }, removed implausibly low outliers, and summarized the lowest plausible total-stay price cluster. Google Travel public links may ignore date parameters, so this checked quote is not linked as an exact booking URL.`,
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
