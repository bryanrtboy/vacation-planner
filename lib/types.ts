export type TripLength = "7-nights" | "1-month";

export type TripPreferences = {
  departure: string;
  flightCount: number;
  nights: number;
  lodging: string;
  interests: string;
};

export type TripWindow = {
  departDate: string;
  returnDate: string;
  label: string;
  reason: string;
};

export type TransportMode =
  | "Train-first"
  | "No car needed"
  | "Car useful"
  | "Driver recommended"
  | "Avoid self-driving";

export type PriceSourceKind = "mock" | "live" | "cached" | "unavailable";

export type PriceRange = {
  min: number;
  max: number;
  currency: "USD";
  label: string;
  provider: string;
  sampledDates: string;
  retrievedAt: string;
  sourceUrl?: string;
  sourceDetail?: string;
  sourceKind: PriceSourceKind;
};

export type Destination = {
  slug: string;
  name: string;
  region: string;
  mapQuery: string;
  tripType: string;
  fitSummary: string;
  caveat: string;
  bestMonths: string;
  avoid: string;
  visualTheme: {
    accentName: string;
    bannerClass: string;
    photoUrl: string;
    photoPosition?: string;
    photoOverlay?: string;
    heroOverlayClass: string;
    cardClass: string;
    panelClass: string;
    summaryClass: string;
    highlightClass: string;
    highlightInfoClass: string;
    buttonClass: string;
    watchActiveClass: string;
    textClass: string;
    moodLabel: string;
  };
  flightSearch: {
    origin: string;
    destination: string;
    destinationAirports: string[];
    departDate: string;
    returnDate: string;
  };
  transport: TransportMode;
  transportNote: string;
  monthlyPotential: "Excellent" | "Good" | "Selective" | "Limited";
  sharedRentalPotential: "Excellent" | "Good" | "Possible" | "Limited";
  fit: {
    art: number;
    gardens: number;
    food: number;
    landscape: number;
  };
  airfare: PriceRange;
  lodging: {
    hotel3Star: PriceRange;
    hotel4StarDeal?: PriceRange;
    rental: PriceRange;
  };
  dining: PriceRange;
  highlights: string[];
  curatedFinds?: {
    label: string;
    note: string;
    url?: string;
    kind: "art" | "craft" | "day-trip" | "food" | "landscape" | "lodging" | "retreat";
  }[];
  retreatNote?: string;
  links: {
    label: string;
    url: string;
    kind: "airfare" | "lodging" | "art" | "transport" | "guide";
  }[];
};

export type WatchedSearch = {
  id: string;
  destinationSlug: string;
  destinationName: string;
  route: string;
  season: string;
  tripLength: TripLength;
  origin?: string;
  adults?: number;
  departDate?: string;
  returnDate?: string;
  destinationAirports?: string[];
  lastCheckedAt?: string;
  lastRange?: {
    min: number;
    max: number;
  };
  lastProvider?: string;
  lastSampledDates?: string;
  lastSourceUrl?: string;
  lastSourceDetail?: string;
  lastSourceKind?: PriceSourceKind;
};

export type WatchRefreshResult = {
  id: string;
  destinationSlug: string;
  destinationName: string;
  status: "checked" | "skipped" | "capped" | "error";
  message: string;
  provider?: string;
  previousRange?: {
    min: number;
    max: number;
  };
  currentRange?: {
    min: number;
    max: number;
  };
  sampledDates?: string;
  retrievedAt?: string;
  sourceUrl?: string;
  sourceDetail?: string;
  sourceKind: PriceSourceKind;
};

export type UsageState = {
  day: string;
  used: number;
  limit: number;
  remaining: number;
};

export type SavedSearchSummary = {
  id: string;
  label: string;
  detail: string;
  kind: "airfare" | "lodging";
  destinationSlug: string;
  destinationName: string;
  departure?: string;
  flightCount?: number;
  nights?: number;
  lodging?: string;
  departDate?: string;
  returnDate?: string;
  updatedAt: string;
};

export type DestinationSuggestionStatus = "draft" | "accepted" | "hidden";

export type DestinationSuggestionPromptKind = "more-like-this" | "more-in-region" | "manual";

export type DestinationSuggestion = {
  id: string;
  requestKey: string;
  status: DestinationSuggestionStatus;
  source: "gemini" | "openai";
  promptKind: DestinationSuggestionPromptKind;
  parentSlug?: string;
  region?: string;
  name: string;
  destinationSlug?: string;
  payload: {
    name: string;
    region: string;
    moodLabel?: string;
    whyItFits: string;
    bestMonths: string;
    tradeoffs: string;
    airportTargets: string[];
    lodgingAngle: string;
    interests: string[];
    starterLinks?: {
      label: string;
      url: string;
      kind: "art" | "food" | "lodging" | "transport" | "guide";
    }[];
    photoSearch?: string;
  };
  rawResponseJson?: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
};
