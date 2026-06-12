import { googleHotelsSearchUrl, lodgingInspectUrl } from "@/lib/lodging/links";
import { lodgingSearchQuery, type LodgingMode } from "@/lib/lodging/modes";
import type { Destination, TripWindow, WatchRefreshResult } from "@/lib/types";

const serpApiEndpoint = "https://serpapi.com/search";

type SerpApiRate = {
  extracted_lowest?: number;
  extracted_before_taxes_fees?: number;
};

type SerpApiCoordinates = {
  latitude?: number;
  longitude?: number;
};

type SerpApiPriceOption = {
  source?: string;
  link?: string;
};

type SerpApiHotelProperty = {
  name?: string;
  type?: string;
  link?: string;
  price?: string;
  extracted_price?: number;
  property_token?: string;
  gps_coordinates?: SerpApiCoordinates;
  prices?: SerpApiPriceOption[];
  overall_rating?: number;
  rating?: number;
  reviews?: number;
  hotel_class?: string;
  extracted_hotel_class?: number;
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

function numericCount(...values: unknown[]) {
  return values.find(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value) && value >= 0
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

function googleHotelsPropertyUrl(
  context: LodgingSearchContext,
  propertyToken: string | undefined
) {
  const params = new URLSearchParams({
    q: lodgingSearchQuery(context.destination, context.mode),
    check_in_date: context.tripWindow.departDate,
    check_out_date: context.tripWindow.returnDate,
    adults: String(context.mode.adults),
    children: "0",
    currency: "USD",
    hl: "en",
    gl: "us"
  });

  if (context.mode.vacationRental) {
    params.set("vacation_rentals", "true");
  }

  if (propertyToken) {
    params.set("property_token", propertyToken);
  }

  return `https://www.google.com/travel/search?${params.toString()}`;
}

function googleMapsUrl(coordinates: SerpApiCoordinates | undefined, name: string) {
  if (
    typeof coordinates?.latitude === "number" &&
    Number.isFinite(coordinates.latitude) &&
    typeof coordinates.longitude === "number" &&
    Number.isFinite(coordinates.longitude)
  ) {
    const params = new URLSearchParams({
      api: "1",
      query: `${coordinates.latitude},${coordinates.longitude}`
    });
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }

  const params = new URLSearchParams({ q: name });
  return `https://www.google.com/search?${params.toString()}`;
}

function priceSourceNames(property: SerpApiHotelProperty) {
  return [...new Set((property.prices ?? []).map((price) => price.source).filter(Boolean))] as string[];
}

function directListingLink(property: SerpApiHotelProperty) {
  return property.link ?? property.prices?.find((price) => price.link)?.link;
}

type LodgingCandidate = {
  name: string;
  link?: string;
  googleResultUrl?: string;
  mapsUrl?: string;
  sourceNames: string[];
  propertyType?: string;
  rating?: number;
  reviews?: number;
  hotelClass?: number;
  nightly: number;
  total: number;
  source: "representative" | "low-price";
  excludedReason?: string;
};

export type LodgingInspection = {
  result: WatchRefreshResult | null;
  rawCandidates: LodgingCandidate[];
  compatibleCandidates: LodgingCandidate[];
  summarizedCandidates: LodgingCandidate[];
  query: string;
  googleSearchUrl: string;
};

const outdoorLodgingPattern =
  /\b(camp|camping|campsite|tent|rv|yurt|glamping|hostel|dorm|shared room)\b/i;
const hotelBrandPattern =
  /\b(hotel|inn|motel|aparthotel|hilton|hyatt|marriott|sheraton|wyndham|la quinta|holiday inn|quality inn|comfort inn|hampton|home2|candlewood|best western|travelodge|days inn|super 8)\b/i;
const homeRentalPattern =
  /\b(apartment|studio|condo|flat|loft|bungalow|cottage|guesthouse|guest house|house|home|cabin|suite|retreat|townhouse|villa|riad|rental)\b/i;
const groupRentalPattern = /\b(house|home|cottage|cabin|villa|townhouse|retreat|bungalow)\b/i;

function candidateForProperty(
  property: SerpApiHotelProperty,
  nights: number,
  source: LodgingCandidate["source"],
  context: LodgingSearchContext
): LodgingCandidate | null {
  const total = totalRate(property, nights);
  if (typeof total !== "number") return null;

  const nightly = total / nights;
  if (!Number.isFinite(nightly) || nightly <= 0) return null;

  return {
    name: property.name ?? "Unnamed lodging",
    link: directListingLink(property),
    googleResultUrl: googleHotelsPropertyUrl(context, property.property_token),
    mapsUrl: googleMapsUrl(property.gps_coordinates, property.name ?? context.destination.name),
    sourceNames: priceSourceNames(property),
    propertyType: property.type,
    rating: numericRate(property.overall_rating, property.rating),
    reviews: numericCount(property.reviews),
    hotelClass: numericRate(property.extracted_hotel_class),
    nightly,
    total,
    source
  };
}

function normalizedCandidateName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function uniqueCandidates(candidates: LodgingCandidate[]) {
  const byName = new Map<string, LodgingCandidate>();
  for (const candidate of candidates) {
    const key = normalizedCandidateName(candidate.name);
    const current = byName.get(key);
    if (
      !current ||
      candidate.source === "representative" ||
      (current.source !== "representative" && candidate.total < current.total)
    ) {
      byName.set(key, candidate);
    }
  }
  return [...byName.values()];
}

function candidateModeRejection(candidate: LodgingCandidate, mode: LodgingMode) {
  const searchText = `${candidate.name} ${candidate.propertyType ?? ""}`;
  if (outdoorLodgingPattern.test(searchText)) return "Outdoor, camping, hostel, or shared lodging";

  if (mode.id === "hotel") return undefined;
  if (hotelBrandPattern.test(searchText)) return "Hotel result in rental mode";
  if (mode.id === "group-house" && !groupRentalPattern.test(searchText)) {
    return "Not clearly a house or group rental";
  }
  if (mode.id !== "group-house" && !homeRentalPattern.test(searchText)) {
    return "Not clearly an apartment, studio, condo, or home rental";
  }

  return undefined;
}

function candidateQualityRejection(candidate: LodgingCandidate, mode: LodgingMode) {
  if (mode.id === "hotel" && typeof candidate.hotelClass === "number" && candidate.hotelClass < 3) {
    return "Below 3-star hotel class";
  }

  if (typeof candidate.rating !== "number") return "No guest rating";

  const reviews = candidate.reviews ?? 0;
  if (reviews >= 30 && candidate.rating < 4.3) {
    return "Low guest rating for a well-reviewed stay";
  }
  if (reviews >= 8 && candidate.rating < 4.15) {
    return "Low guest rating";
  }

  return undefined;
}

function hasUsefulRating(candidate: LodgingCandidate) {
  return (
    typeof candidate.rating === "number" &&
    candidate.rating >= 4.3 &&
    typeof candidate.reviews === "number" &&
    candidate.reviews >= 8
  );
}

function median(values: number[]) {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  if (!sorted.length) return undefined;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function removeOutliers(candidates: LodgingCandidate[]) {
  if (candidates.length < 5) return candidates;

  const medianNightly = median(candidates.map((candidate) => candidate.nightly));
  if (typeof medianNightly !== "number") return candidates;

  const floor = medianNightly * 0.55;
  const ceiling = medianNightly * 2.4;
  const filtered = candidates.filter(
    (candidate) => candidate.nightly >= floor && candidate.nightly <= ceiling
  );
  return filtered.length >= 3 ? filtered : candidates;
}

function percentile(values: number[], percentileValue: number) {
  const sorted = [...values].sort((first, second) => first - second);
  if (!sorted.length) return undefined;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((sorted.length - 1) * percentileValue))
  );
  return sorted[index];
}

function representativeRange(candidates: LodgingCandidate[]) {
  const totals = candidates.map((candidate) => candidate.total);
  const min = percentile(totals, candidates.length >= 8 ? 0.32 : 0.25);
  const max = percentile(totals, candidates.length >= 8 ? 0.62 : 0.6);
  if (typeof min !== "number" || typeof max !== "number") return null;
  return {
    min: Math.round(Math.min(min, max)),
    max: Math.round(Math.max(min, max))
  };
}

function regionalPlanningNightlyFloor(context: LodgingSearchContext) {
  const region = context.destination.region.toLowerCase();
  const modeMultiplier = context.mode.id === "group-house" ? 1.8 : 1;

  if (region.includes("united states") || region.includes("canada")) return 120 * modeMultiplier;
  if (
    region.includes("france") ||
    region.includes("italy") ||
    region.includes("spain") ||
    region.includes("portugal") ||
    region.includes("austria") ||
    region.includes("slovenia") ||
    region.includes("europe")
  ) {
    return 85 * modeMultiplier;
  }
  if (region.includes("japan")) return 70 * modeMultiplier;
  if (region.includes("mexico") || region.includes("morocco")) return 55 * modeMultiplier;

  return 75 * modeMultiplier;
}

function planningRange(candidates: LodgingCandidate[], context: LodgingSearchContext, nights: number) {
  const representative = candidates
    .filter((candidate) => candidate.source === "representative")
    .sort((first, second) => first.total - second.total);
  const lowPrice = candidates
    .filter((candidate) => candidate.source === "low-price")
    .sort((first, second) => first.total - second.total);

  if (representative.length >= 4 && lowPrice.length >= 4) {
    const representativeLow = percentile(
      representative.map((candidate) => candidate.total),
      representative.length >= 8 ? 0.32 : 0.25
    );
    const representativeHigh = percentile(
      representative.map((candidate) => candidate.total),
      representative.length >= 8 ? 0.82 : 0.75
    );
    const lowPriceLow = percentile(
      lowPrice.map((candidate) => candidate.total),
      lowPrice.length >= 8 ? 0.48 : 0.45
    );
    const lowPriceHigh = percentile(
      lowPrice.map((candidate) => candidate.total),
      lowPrice.length >= 8 ? 0.72 : 0.7
    );
    const representativeMedian = percentile(representative.map((candidate) => candidate.total), 0.5);
    const lowPriceMedian = percentile(lowPrice.map((candidate) => candidate.total), 0.5);

    if (
      typeof representativeLow === "number" &&
      typeof representativeHigh === "number" &&
      typeof lowPriceLow === "number" &&
      typeof lowPriceHigh === "number" &&
      typeof representativeMedian === "number" &&
      typeof lowPriceMedian === "number"
    ) {
      const lowPriceMedianNightly = lowPriceMedian / nights;
      const lowPriceIsPlanningQuality =
        lowPriceMedianNightly >= regionalPlanningNightlyFloor(context);
      const representativeLooksOverpriced = representativeMedian > lowPriceMedian * 1.35;
      const planningFloor = regionalPlanningNightlyFloor(context) * nights;
      const min =
        lowPriceIsPlanningQuality && representativeLooksOverpriced
          ? lowPriceMedian
          : Math.max(representativeMedian, representativeLow, planningFloor);
      const max =
        lowPriceIsPlanningQuality && representativeLooksOverpriced
          ? lowPriceHigh
          : Math.max(min, representativeHigh);

      return {
        min: Math.round(Math.min(min, max)),
        max: Math.round(Math.max(min, max))
      };
    }
  }

  return representativeRange(candidates);
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

function serpApiParams(
  context: LodgingSearchContext,
  sort: LodgingCandidate["source"]
) {
  const key = apiKey();
  if (!key) return null;

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
    gl: "us"
  });

  if (sort === "low-price") {
    params.set("sort_by", "3");
  }

  if (context.mode.vacationRental) {
    params.set("vacation_rentals", "true");
  } else {
    params.set("hotel_class", "3,4");
  }

  return params;
}

async function fetchSerpApiHotels(
  context: LodgingSearchContext,
  sort: LodgingCandidate["source"]
) {
  const params = serpApiParams(context, sort);
  if (!params) throw new Error("Lodging checks are not configured yet.");

  const response = await fetch(`${serpApiEndpoint}?${params.toString()}`);
  const data = (await response.json().catch(() => ({}))) as SerpApiHotelsResponse;

  if (!response.ok) {
    throw new Error(data.error ?? `Lodging check returned ${response.status}.`);
  }

  if (data.error) throw new Error(data.error);
  return { data, source: sort };
}

function normalizeLodging(
  responses: { data: SerpApiHotelsResponse; source: LodgingCandidate["source"] }[],
  context: LodgingSearchContext
): LodgingInspection {
  const nights = nightsBetween(context.tripWindow);
  const rawCandidates = uniqueCandidates(
    responses.flatMap(({ data, source }) =>
      (data.properties ?? []).map((property) =>
        candidateForProperty(property, nights, source, context)
      )
    )
      .filter((candidate): candidate is LodgingCandidate => Boolean(candidate))
  );
  const annotatedCandidates = rawCandidates.map((candidate) => ({
    ...candidate,
    excludedReason:
      candidateModeRejection(candidate, context.mode) ??
      candidateQualityRejection(candidate, context.mode)
  }));
  const qualityCandidates = annotatedCandidates.filter((candidate) => !candidate.excludedReason);
  const ratedCandidates = qualityCandidates.filter(hasUsefulRating);
  const pricingCandidates =
    ratedCandidates.length >= 4
      ? ratedCandidates
      : qualityCandidates.length >= 4
        ? qualityCandidates
        : [];
  const candidates = removeOutliers(pricingCandidates).sort(
    (first, second) => first.total - second.total
  );
  const range = planningRange(candidates, context, nights);
  const query = lodgingSearchQuery(context.destination, context.mode);
  const googleSearchUrl = googleHotelsSearchUrl(context.destination, context.tripWindow, context.mode);

  if (!range) {
    return {
      result: null,
      rawCandidates: annotatedCandidates,
      compatibleCandidates: pricingCandidates,
      summarizedCandidates: candidates,
      query,
      googleSearchUrl
    };
  }

  const result: WatchRefreshResult = {
    id: `${context.destination.slug}-${context.mode.id}-lodging`,
    destinationSlug: context.destination.slug,
    destinationName: context.destination.name,
    status: "checked",
    message: `Google Hotels ${context.mode.label.toLowerCase()} pricing checked ${
      rawCandidates.length
    } unique result${rawCandidates.length === 1 ? "" : "s"}; displayed range uses a trimmed representative ${
      context.mode.label.toLowerCase()
    } band after filtering mismatched lodging types and outliers.`,
    provider: "SerpApi Google Hotels",
    currentRange: range,
    sampledDates: `${context.tripWindow.departDate}-${context.tripWindow.returnDate}`,
    retrievedAt: new Date().toISOString(),
    sourceUrl: lodgingInspectUrl(context.destination, context.tripWindow, context.mode),
    sourceDetail:
      `Lodging checked through Google Hotels using exact SerpApi dates with both representative and low-price result sets. Filtered ${rawCandidates.length} unique result${
      rawCandidates.length === 1 ? "" : "s"
      } to ${pricingCandidates.length} quality-compatible ${context.mode.label.toLowerCase()} result${
        pricingCandidates.length === 1 ? "" : "s"
      }, required guest ratings when enough rated stays were available, removed outliers, and summarized a trimmed representative total-stay range instead of the cheapest or highest listings. Google Travel public links may require confirming dates manually; the checked estimate comes from SerpApi date parameters.`,
    sourceKind: "live"
  };

  return {
    result,
    rawCandidates: annotatedCandidates,
    compatibleCandidates: pricingCandidates,
    summarizedCandidates: candidates,
    query,
    googleSearchUrl
  };
}

export async function inspectSerpApiLodging(context: LodgingSearchContext): Promise<LodgingInspection> {
  const key = apiKey();
  if (!key) {
    throw new Error("Lodging checks are not configured yet.");
  }

  const responses = await Promise.allSettled([
    fetchSerpApiHotels(context, "representative"),
    fetchSerpApiHotels(context, "low-price")
  ]);
  const successfulResponses = responses
    .filter((response): response is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchSerpApiHotels>>> =>
      response.status === "fulfilled"
    )
    .map((response) => response.value);

  if (!successfulResponses.length) {
    const error = responses.find(
      (response): response is PromiseRejectedResult => response.status === "rejected"
    )?.reason;
    throw error instanceof Error ? error : new Error("No lodging results returned.");
  }

  return normalizeLodging(successfulResponses, context);
}

export async function sampleSerpApiLodging(
  context: LodgingSearchContext
): Promise<WatchRefreshResult> {
  try {
    const inspection = await inspectSerpApiLodging(context);
    if (!inspection.result) {
      return unavailableResult(
        context,
        `No Google Hotels prices were returned for ${context.mode.label.toLowerCase()}.`
      );
    }

    return inspection.result;
  } catch (error) {
    return unavailableResult(context, "Unable to check Google Hotels prices.", error);
  }
}
