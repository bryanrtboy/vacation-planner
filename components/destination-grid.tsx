"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BedDouble,
  CalendarDays,
  Car,
  ChevronDown,
  MapPin,
  Palette,
  Plane,
  SlidersHorizontal,
  Sparkles,
  Users
} from "lucide-react";
import { DestinationCard } from "@/components/destination-card";
import { lodgingModeFromPreference, lodgingSnapshotKey } from "@/lib/lodging/modes";
import {
  defaultTripPreferences,
  minimumFlightCountForLodging,
  normalizeFlightCount,
  readTripPreferences,
  recommendedTripWindow,
  savedSearchSelectedEvent,
  tripLengthLabel,
  tripPreferencesChangedEvent,
  writeTripPreferences
} from "@/lib/trip-preferences";
import type {
  Destination,
  DestinationSuggestion,
  SavedSearchSummary,
  TripWindow,
  UsageState,
  WatchRefreshResult
} from "@/lib/types";
import type { TripPreferences } from "@/lib/types";

const fareSnapshotStorageKey = "artist-travel-finder:fare-snapshots";
const lodgingSnapshotStorageKey = "artist-travel-finder:lodging-snapshots";
const initialVisibleDestinations = 9;
const destinationPageSize = 6;
const allRegionsFilter = "all";
const allTravelFilter = "all";
const allInterestsFilter = "all";
const noScoreSort = "none";
const unitedStatesRegion = "United States";
const usRegionNames = new Set([
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "washington dc",
  "district of columbia",
  "west virginia",
  "wisconsin",
  "wyoming",
  "pacific northwest",
  "southwest",
  "rocky mountains",
  "new england"
]);
const usCountryAliases = new Set(["us", "u s", "usa", "u s a", "united states", "united states of america"]);

const airportOptions = [
  { code: "DEN", label: "Denver" },
  { code: "ABQ", label: "Albuquerque" },
  { code: "ATL", label: "Atlanta" },
  { code: "AUS", label: "Austin" },
  { code: "BNA", label: "Nashville" },
  { code: "BOS", label: "Boston" },
  { code: "DFW", label: "Dallas-Fort Worth" },
  { code: "JFK", label: "New York JFK" },
  { code: "LAX", label: "Los Angeles" },
  { code: "ORD", label: "Chicago O'Hare" },
  { code: "PHX", label: "Phoenix" },
  { code: "SEA", label: "Seattle" },
  { code: "SFO", label: "San Francisco" },
  { code: "SLC", label: "Salt Lake City" }
];

const nightOptions = [5, 7, 10, 14, 21, 28];

const lodgingOptions = [
  "rentals first",
  "hotels",
  "apartments for 2",
  "group house rentals",
  "best total value"
];

const interestOptions = [
  "art · food · gardens",
  "art · craft · coast",
  "food · trains · architecture",
  "gardens · landscape · quiet bases",
  "relaxation · recharging · beautiful settings",
  "bay · ocean views · food",
  "rural escape · slow days",
  "custom"
];

const resultInterestOptions = [
  { value: "art", label: "art" },
  { value: "food", label: "food" },
  { value: "gardens", label: "gardens" },
  { value: "landscape", label: "landscape" },
  { value: "coast", label: "coast / water" },
  { value: "architecture", label: "architecture" },
  { value: "trains", label: "train-friendly" },
  { value: "quiet bases", label: "quiet bases" },
  { value: "rural", label: "rural" }
];

type StoredFareSnapshots = Record<string, WatchRefreshResult>;

type SnapshotResponse = {
  usage: UsageState;
  results: WatchRefreshResult[];
};

type SuggestionResponse = {
  usage: UsageState;
  suggestions: DestinationSuggestion[];
  message?: string;
  storageReady?: boolean;
};

type DestinationScenarioResponse = {
  scenarios?: {
    destinationSlug: string;
    preferences: TripPreferences;
  }[];
};

type CheckedScenario = Partial<TripPreferences> & {
  updatedAt?: string;
};

const interestSynonyms: Record<string, string[]> = {
  art: ["art", "gallery", "galleries", "museum", "museums", "design", "ceramics", "mosaics"],
  craft: ["craft", "ceramics", "tile", "tiles", "print", "workshops", "studio"],
  food: ["food", "market", "markets", "dining", "restaurant", "wine"],
  gardens: ["garden", "gardens", "botanical", "green"],
  coast: ["coast", "coastal", "ocean", "sea", "bay", "waterfront", "ferry", "ferries"],
  trains: ["train", "trains", "rail", "no car needed", "train-first"],
  architecture: ["architecture", "porticoes", "historic", "university", "design"],
  landscape: ["landscape", "views", "view", "lake", "mountain", "coast", "coastal", "desert"],
  "quiet bases": ["quiet", "base", "bases", "slow", "low-key", "apartment", "cottage"],
  relaxation: ["quiet", "slow", "retreat", "escape", "coast", "coastal", "garden", "landscape"],
  recharging: ["quiet", "slow", "retreat", "escape", "low-key", "cottage", "landscape"],
  "beautiful settings": ["landscape", "views", "view", "coast", "coastal", "bay", "ocean", "lake", "garden"],
  bay: ["bay", "waterfront", "ferry", "ferries", "coast", "coastal"],
  ocean: ["ocean", "sea", "coast", "coastal", "waterfront"],
  views: ["views", "view", "landscape", "coast", "coastal", "lake", "mountain"],
  rural: ["rural", "cottage", "quiet", "escape", "landscape", "slow"],
  escape: ["escape", "retreat", "quiet", "slow", "cottage", "landscape"]
};

const scoredInterests: Partial<Record<string, keyof Destination["fit"]>> = {
  art: "art",
  food: "food",
  gardens: "gardens",
  landscape: "landscape"
};

function interestTerms(preferences: TripPreferences["interests"]) {
  if (!preferences.trim()) return [];
  return preferences
    .toLowerCase()
    .split(/[·,;/]+|\band\b/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function destinationInterestText(destination: Destination) {
  return [
    destination.name,
    destination.region,
    destination.tripType,
    destination.fitSummary,
    destination.caveat,
    destination.bestMonths,
    destination.avoid,
    destination.transport,
    destination.transportNote,
    destination.monthlyPotential,
    destination.sharedRentalPotential,
    destination.highlights.join(" "),
    destination.retreatNote,
    destination.curatedFinds?.map((find) => `${find.label} ${find.note} ${find.kind}`).join(" "),
    destination.links.map((link) => `${link.label} ${link.kind}`).join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function destinationMatchesInterests(destination: Destination, preferences: TripPreferences["interests"]) {
  if (preferences === allInterestsFilter || preferences === "all interests") return true;

  const terms = interestTerms(preferences);
  if (!terms.length) return true;

  const text = destinationInterestText(destination);

  return terms.some((term) => {
    const scoredInterest = scoredInterests[term];
    if (scoredInterest && destination.fit[scoredInterest] >= 7) return true;

    const termsToMatch = interestSynonyms[term] ?? [term];
    return termsToMatch.some((candidate) => text.includes(candidate));
  });
}

function checkedNightsBetween(departDate: string | undefined, returnDate: string | undefined) {
  if (!departDate || !returnDate) return undefined;
  const start = new Date(`${departDate}T00:00:00Z`).getTime();
  const end = new Date(`${returnDate}T00:00:00Z`).getTime();
  const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Number.isFinite(nights) && nights > 0 ? nights : undefined;
}

function lodgingPreferenceFromSnapshotMode(mode: string | undefined) {
  if (mode === "hotel") return "hotels";
  if (mode === "group-house") return "group house rentals";
  if (mode === "apartment") return "apartments for 2";
  return undefined;
}

function lodgingScenarioFromLocalKey(key: string, result: WatchRefreshResult): CheckedScenario | undefined {
  const parts = key.split(":");
  let travelMode: TripPreferences["travelMode"] | undefined;
  let slug: string | undefined;
  let mode: string | undefined;
  let departDate: string | undefined;
  let returnDate: string | undefined;
  let adults: string | undefined;

  if (parts[0] === "v7") {
    [, slug, mode, departDate, returnDate, adults] = parts;
  } else {
    const [legacyTravelMode, version, legacySlug, legacyMode, legacyDepartDate, legacyReturnDate, legacyAdults] = parts;
    if (version !== "v7") return undefined;
    travelMode = legacyTravelMode === "drive" ? "drive" : "fly";
    slug = legacySlug;
    mode = legacyMode;
    departDate = legacyDepartDate;
    returnDate = legacyReturnDate;
    adults = legacyAdults;
  }

  if (!slug || !departDate || !returnDate) return undefined;

  return {
    travelMode,
    flightCount: Number(adults) || undefined,
    nights: checkedNightsBetween(departDate, returnDate),
    lodging: lodgingPreferenceFromSnapshotMode(mode),
    departDate,
    returnDate,
    travelSeason: "saved",
    updatedAt: result.retrievedAt
  };
}

function newerScenario(current: CheckedScenario | undefined, candidate: CheckedScenario) {
  if (!current?.updatedAt) return candidate;
  if (!candidate.updatedAt) return current;
  return new Date(candidate.updatedAt).getTime() > new Date(current.updatedAt).getTime()
    ? candidate
    : current;
}

function definedScenario(scenario: CheckedScenario | undefined) {
  if (!scenario) return {};
  return Object.fromEntries(
    Object.entries(scenario).filter(([, value]) => value !== undefined)
  ) as Partial<TripPreferences>;
}

function preferencesFromSavedSearch(
  search: SavedSearchSummary,
  preferences: TripPreferences
): TripPreferences {
  return {
    ...preferences,
    departure: search.departure ?? preferences.departure,
    travelMode: search.travelMode ?? preferences.travelMode,
    flightCount: search.flightCount ?? preferences.flightCount,
    nights: search.nights ?? preferences.nights,
    lodging: search.lodging ?? preferences.lodging,
    departDate: search.departDate,
    returnDate: search.returnDate,
    travelSeason: search.departDate && search.returnDate ? "saved" : preferences.travelSeason
  };
}

function destinationMatchesRegion(destination: Destination, regionFilter: string) {
  if (regionFilter === allRegionsFilter) return true;
  if (destination.region === regionFilter) return true;
  if (regionFilter !== unitedStatesRegion) return false;

  return isUnitedStatesRegion(destination.region);
}

function normalizeRegionPart(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUnitedStatesRegion(region: string) {
  const normalized = normalizeRegionPart(region);
  if (usRegionNames.has(normalized) || usCountryAliases.has(normalized)) return true;

  const parts = normalized
    .split(/[,/|;()]+|\s+-\s+|\s+in\s+|\s+near\s+/)
    .map(normalizeRegionPart)
    .filter(Boolean);

  return parts.some((part) => usRegionNames.has(part) || usCountryAliases.has(part));
}

function normalizeNights(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultTripPreferences.nights;
  return Math.min(Math.max(Math.round(parsed), 1), 60);
}

function readStoredSnapshots(): StoredFareSnapshots {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(fareSnapshotStorageKey);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as StoredFareSnapshots;
  } catch {
    return {};
  }
}

function writeStoredSnapshots(snapshots: StoredFareSnapshots) {
  window.localStorage.setItem(fareSnapshotStorageKey, JSON.stringify(snapshots));
}

function readStoredLodgingSnapshots(): StoredFareSnapshots {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(lodgingSnapshotStorageKey);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as StoredFareSnapshots;
  } catch {
    return {};
  }
}

function writeStoredLodgingSnapshots(snapshots: StoredFareSnapshots) {
  window.localStorage.setItem(lodgingSnapshotStorageKey, JSON.stringify(snapshots));
}

function unavailableSnapshots(slugs: string[], message: string): StoredFareSnapshots {
  const checkedAt = new Date().toISOString();
  return Object.fromEntries(
    slugs.map((slug) => [
      slug,
      {
        id: `${slug}-card-snapshot`,
        destinationSlug: slug,
        destinationName: slug,
        status: "error" as const,
        message,
        retrievedAt: checkedAt,
        sourceKind: "unavailable" as const
      }
    ])
  );
}

export function DestinationGrid({ destinations }: { destinations: Destination[] }) {
  const [snapshots, setSnapshots] = useState<StoredFareSnapshots>(readStoredSnapshots);
  const [lodgingSnapshots, setLodgingSnapshots] =
    useState<StoredFareSnapshots>(readStoredLodgingSnapshots);
  const [preferences, setPreferences] = useState<TripPreferences>(defaultTripPreferences);
  const [generatorRegion, setGeneratorRegion] = useState(allRegionsFilter);
  const [generatorControlsOpen, setGeneratorControlsOpen] = useState(false);
  const [customNightsOpen, setCustomNightsOpen] = useState(false);
  const [customInterestsOpen, setCustomInterestsOpen] = useState(false);
  const [regionFilter, setRegionFilter] = useState(allRegionsFilter);
  const [libraryInterestFilter, setLibraryInterestFilter] = useState(allInterestsFilter);
  const [resultFiltersOpen, setResultFiltersOpen] = useState(false);
  const [travelFilter, setTravelFilter] = useState(allTravelFilter);
  const [scoreSort, setScoreSort] = useState<keyof Destination["fit"] | typeof noScoreSort>(
    noScoreSort
  );
  const [visibleCount, setVisibleCount] = useState(initialVisibleDestinations);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [lodgingUsage, setLodgingUsage] = useState<UsageState | null>(null);
  const [aiUsage, setAiUsage] = useState<UsageState | null>(null);
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearchSummary[]>([]);
  const [focusedSavedSearch, setFocusedSavedSearch] = useState<SavedSearchSummary | null>(null);
  const [scenarioOverrides, setScenarioOverrides] = useState<Record<string, Partial<TripPreferences>>>({});
  const [photoOverrides, setPhotoOverrides] = useState<Record<string, string>>({});
  const [expandedDestinationSlugs, setExpandedDestinationSlugs] = useState<Set<string>>(
    () => new Set()
  );
  const [checkingSlugs, setCheckingSlugs] = useState<Set<string>>(() => new Set());
  const [checkingLodgingSlugs, setCheckingLodgingSlugs] = useState<Set<string>>(() => new Set());
  const [suggestingDestinations, setSuggestingDestinations] = useState(false);
  const [reviewingSuggestionId, setReviewingSuggestionId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [lodgingStatusMessage, setLodgingStatusMessage] = useState("");
  const [suggestionStatusMessage, setSuggestionStatusMessage] = useState("");
  const destinationSlugs = useMemo(
    () => destinations.map((destination) => destination.slug),
    [destinations]
  );
  const regions = useMemo(
    () => {
      const regionSet = new Set(destinations.map((destination) => destination.region));
      if (destinations.some((destination) => isUnitedStatesRegion(destination.region))) {
        regionSet.add(unitedStatesRegion);
      }
      return [...regionSet].sort();
    },
    [destinations]
  );
  const libraryInterestOptions = useMemo(
    () =>
      resultInterestOptions
        .map((option) => ({
          ...option,
          count: destinations.filter((destination) =>
            destinationMatchesInterests(destination, option.value)
          ).length
        }))
        .filter((option) => option.count > 0),
    [destinations]
  );
  const destinationHasDriveOption = useCallback(
    (destination: Destination) =>
      scenarioOverrides[destination.slug]?.travelMode === "drive" ||
      savedSearches.some(
        (search) => search.destinationSlug === destination.slug && search.travelMode === "drive"
      ),
    [savedSearches, scenarioOverrides]
  );
  const destinationHasFlyOption = useCallback(
    (destination: Destination) =>
      savedSearches.some(
        (search) => search.destinationSlug === destination.slug && search.travelMode === "fly"
      ) || !destinationHasDriveOption(destination),
    [destinationHasDriveOption, savedSearches]
  );
  const filteredDestinations = useMemo(() => {
    if (focusedSavedSearch) {
      return destinations.filter(
        (destination) => destination.slug === focusedSavedSearch.destinationSlug
      );
    }

    const filtered = destinations.filter((destination) => {
      const regionMatches = destinationMatchesRegion(destination, regionFilter);
      const travelMatches =
        travelFilter === allTravelFilter ||
        (travelFilter === "drive"
          ? destinationHasDriveOption(destination)
          : destinationHasFlyOption(destination));
      const interestMatches =
        libraryInterestFilter === allInterestsFilter ||
        destinationMatchesInterests(destination, libraryInterestFilter);
      return regionMatches && travelMatches && interestMatches;
    });

    if (scoreSort === noScoreSort) return filtered;

    return [...filtered].sort((a, b) => {
      const scoreDelta = b.fit[scoreSort] - a.fit[scoreSort];
      return scoreDelta || a.name.localeCompare(b.name);
    });
  }, [
    destinations,
    focusedSavedSearch,
    destinationHasDriveOption,
    destinationHasFlyOption,
    libraryInterestFilter,
    regionFilter,
    scoreSort,
    travelFilter
  ]);
  const visibleDestinations = useMemo(
    () => filteredDestinations.slice(0, visibleCount),
    [filteredDestinations, visibleCount]
  );
  const savedCheckedScenarios = useMemo(() => {
    const bySlug = new Map<string, CheckedScenario>();
    const sortedSearches = [...savedSearches].sort(
      (first, second) =>
        new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
    );

    for (const search of sortedSearches) {
      const scenario: CheckedScenario = {
        departure: search.departure,
        travelMode: search.travelMode,
        flightCount: search.flightCount,
        nights: search.nights,
        lodging: search.lodging,
        departDate: search.departDate,
        returnDate: search.returnDate,
        travelSeason: search.departDate && search.returnDate ? "saved" : undefined,
        updatedAt: search.updatedAt
      };
      bySlug.set(search.destinationSlug, newerScenario(bySlug.get(search.destinationSlug), scenario));
    }

    return bySlug;
  }, [savedSearches]);
  const localCheckedScenarios = useMemo(() => {
    const bySlug = new Map<string, CheckedScenario>();

    for (const [key, result] of Object.entries(lodgingSnapshots)) {
      if (result.status !== "checked") continue;
      const scenario = lodgingScenarioFromLocalKey(key, result);
      if (!scenario || !result.destinationSlug) continue;
      bySlug.set(result.destinationSlug, newerScenario(bySlug.get(result.destinationSlug), scenario));
    }

    for (const [key, result] of Object.entries(snapshots)) {
      if (result.status !== "checked") continue;
      const [slug, travelMode, departure, flightCount, departDate, returnDate] = key.split(":");
      if (!slug || !departDate || !returnDate) continue;
      const scenario: CheckedScenario = {
        travelMode: travelMode === "drive" ? "drive" : "fly",
        departure,
        flightCount: Number(flightCount) || undefined,
        nights: checkedNightsBetween(departDate, returnDate),
        departDate,
        returnDate,
        travelSeason: "saved",
        updatedAt: result.retrievedAt
      };
      bySlug.set(slug, newerScenario(bySlug.get(slug), scenario));
    }

    return bySlug;
  }, [lodgingSnapshots, snapshots]);
  const scenarioPreferences = useCallback(
    (slug: string) => {
      const checkedScenario = savedCheckedScenarios.get(slug) ?? localCheckedScenarios.get(slug);
      return {
        ...preferences,
        ...definedScenario(checkedScenario),
        ...scenarioOverrides[slug]
      };
    },
    [localCheckedScenarios, preferences, savedCheckedScenarios, scenarioOverrides]
  );
  const tripWindowFor = useCallback(
    (destination: Destination, activePreferences: TripPreferences) =>
      recommendedTripWindow(destination, activePreferences),
    []
  );
  const snapshotKey = useCallback(
    (slug: string, activePreferences: TripPreferences, tripWindow: { departDate: string; returnDate: string }) =>
      `${slug}:${activePreferences.travelMode ?? "fly"}:${activePreferences.departure}:${activePreferences.flightCount}:${tripWindow.departDate}:${tripWindow.returnDate}`,
    []
  );
  const lodgingKey = useCallback(
    (destination: Destination, activePreferences: TripPreferences, tripWindow: TripWindow) =>
      lodgingSnapshotKey(destination, tripWindow, lodgingModeFromPreference(activePreferences.lodging)),
    []
  );
  const legacyLodgingKey = useCallback(
    (destination: Destination, activePreferences: TripPreferences, tripWindow: TripWindow) =>
      `${activePreferences.travelMode ?? "fly"}:${lodgingKey(destination, activePreferences, tripWindow)}`,
    [lodgingKey]
  );
  const savedSearchSnapshotMaps = useMemo(() => {
    const fare: StoredFareSnapshots = {};
    const lodging: StoredFareSnapshots = {};

    for (const search of savedSearches) {
      if (search.result?.status !== "checked") continue;
      const destination = destinations.find((item) => item.slug === search.destinationSlug);
      if (!destination) continue;

      const savedPreferences = preferencesFromSavedSearch(search, preferences);
      const tripWindow = tripWindowFor(destination, savedPreferences);

      if (search.kind === "airfare") {
        fare[snapshotKey(search.destinationSlug, savedPreferences, tripWindow)] = search.result;
      } else {
        lodging[lodgingKey(destination, savedPreferences, tripWindow)] = search.result;
      }
    }

    return { fare, lodging };
  }, [destinations, lodgingKey, preferences, savedSearches, snapshotKey, tripWindowFor]);
  const checkingCount = checkingSlugs.size;
  const checkingLodgingCount = checkingLodgingSlugs.size;
  const shownCount = Math.min(visibleCount, filteredDestinations.length);
  const hasMoreDestinations = visibleCount < filteredDestinations.length;
  const filtersActive =
    regionFilter !== allRegionsFilter ||
    libraryInterestFilter !== allInterestsFilter ||
    travelFilter !== allTravelFilter ||
    scoreSort !== noScoreSort ||
    Boolean(focusedSavedSearch);
  const refreshSavedSearches = useCallback(async () => {
    try {
      const response = await fetch("/api/saved-searches");
      if (!response.ok) return;
      const data = (await response.json()) as { savedSearches?: SavedSearchSummary[] };
      setSavedSearches(data.savedSearches ?? []);
    } catch {
      // Saved searches are an optional D1 enhancement.
    }
  }, []);
  const persistDestinationScenarios = useCallback(
    (slugs: string[], activePreferences: TripPreferences) => {
      void Promise.all(
        slugs.map((destinationSlug) =>
          fetch("/api/destination-scenarios", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              destinationSlug,
              preferences: activePreferences
            })
          }).catch(() => undefined)
        )
      );
    },
    []
  );

  useEffect(() => {
    function syncPreferences() {
      const nextPreferences = readTripPreferences();
      setPreferences(nextPreferences);
      setCustomNightsOpen(!nightOptions.includes(nextPreferences.nights));
      setCustomInterestsOpen(!interestOptions.includes(nextPreferences.interests));
    }

    syncPreferences();
    window.addEventListener(tripPreferencesChangedEvent, syncPreferences);
    window.addEventListener("storage", syncPreferences);
    return () => {
      window.removeEventListener(tripPreferencesChangedEvent, syncPreferences);
      window.removeEventListener("storage", syncPreferences);
    };
  }, []);

  const updateGeneratorPreferences = useCallback(
    (next: Partial<TripPreferences>) => {
      const nextPreferences = {
        ...preferences,
        ...next
      };
      const lodging = nextPreferences.lodging;
      nextPreferences.departure = nextPreferences.departure.trim().toUpperCase();
      nextPreferences.travelMode = nextPreferences.travelMode === "drive" ? "drive" : "fly";
      nextPreferences.flightCount = Math.max(
        normalizeFlightCount(nextPreferences.flightCount),
        minimumFlightCountForLodging(lodging)
      );
      nextPreferences.nights = normalizeNights(nextPreferences.nights);
      setPreferences(nextPreferences);
      writeTripPreferences(nextPreferences);
    },
    [preferences]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSavedSearches() {
      try {
        const response = await fetch("/api/saved-searches");
        if (!response.ok) return;
        const data = (await response.json()) as { savedSearches?: SavedSearchSummary[] };
        if (!cancelled) setSavedSearches(data.savedSearches ?? []);
      } catch {
        // Saved searches are an optional D1 enhancement.
      }
    }

    void loadSavedSearches();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSuggestions() {
      try {
        const response = await fetch("/api/destinations/suggestions");
        if (!response.ok) return;
        const data = (await response.json()) as SuggestionResponse;
        if (cancelled) return;
        setAiUsage(data.usage);
        setSuggestions(data.suggestions);
        if (data.message) setSuggestionStatusMessage(data.message);
      } catch {
        // Suggestions are optional and remain manual-only.
      }
    }

    void hydrateSuggestions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateDestinationScenarios() {
      try {
        const response = await fetch("/api/destination-scenarios");
        if (!response.ok) return;
        const data = (await response.json()) as DestinationScenarioResponse;
        if (cancelled || !data.scenarios?.length) return;
        setScenarioOverrides((current) => ({
          ...Object.fromEntries(
            data.scenarios!.map((scenario) => [
              scenario.destinationSlug,
              scenario.preferences
            ])
          ),
          ...current
        }));
      } catch {
        // Per-destination scenarios are optional; local edits still work without D1.
      }
    }

    void hydrateDestinationScenarios();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateCachedSnapshots() {
      if (preferences.travelMode === "drive") {
        setSnapshots(readStoredSnapshots());
        return;
      }

      try {
        const response = await fetch("/api/airfare/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences, refresh: false, slugs: destinationSlugs })
        });
        if (!response.ok) return;
        const data = (await response.json()) as SnapshotResponse;
        if (cancelled) return;
        setUsage(data.usage);
        setLodgingUsage(data.usage);
        if (!data.results.length) return;

        const nextSnapshots = { ...readStoredSnapshots() };
        for (const result of data.results) {
          const destination = destinations.find((item) => item.slug === result.destinationSlug);
          if (!destination) continue;
          const tripWindow = tripWindowFor(destination, preferences);
          nextSnapshots[snapshotKey(result.destinationSlug, preferences, tripWindow)] = result;
        }

        writeStoredSnapshots(nextSnapshots);
        setSnapshots(nextSnapshots);
      } catch {
        // Local snapshots remain the fallback when durable storage is unavailable.
      }
    }

    void hydrateCachedSnapshots();

    return () => {
      cancelled = true;
    };
  }, [destinationSlugs, destinations, preferences, snapshotKey, tripWindowFor]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateCachedLodgingSnapshots() {
      try {
        const response = await fetch("/api/lodging/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences, refresh: false, slugs: destinationSlugs })
        });
        if (!response.ok) return;
        const data = (await response.json()) as SnapshotResponse;
        if (cancelled) return;
        setLodgingUsage(data.usage);
        setUsage(data.usage);
        if (!data.results.length) return;

        const nextSnapshots = { ...readStoredLodgingSnapshots() };
        for (const result of data.results) {
          const destination = destinations.find((item) => item.slug === result.destinationSlug);
          if (!destination) continue;
          const tripWindow = tripWindowFor(destination, preferences);
          nextSnapshots[lodgingKey(destination, preferences, tripWindow)] = result;
        }

        writeStoredLodgingSnapshots(nextSnapshots);
        setLodgingSnapshots(nextSnapshots);
      } catch {
        // Static lodging estimates remain the fallback when durable storage is unavailable.
      }
    }

    void hydrateCachedLodgingSnapshots();

    return () => {
      cancelled = true;
    };
  }, [destinationSlugs, destinations, lodgingKey, preferences, tripWindowFor]);

  const refreshFareSnapshots = useCallback(
    async (
      slugs: string[],
      options: { manual?: boolean } = {},
      activePreferences: TripPreferences = preferences
    ) => {
      if (!slugs.length) return;

      setCheckingSlugs((current) => new Set([...current, ...slugs]));
      setStatusMessage(options.manual ? "Checking airfare now..." : "Checking airfare...");

      try {
        const response = await fetch("/api/airfare/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences: activePreferences, refresh: Boolean(options.manual), slugs })
        });

        if (!response.ok) throw new Error("Unable to refresh airfare snapshots.");
        const data = (await response.json()) as SnapshotResponse;
        const nextSnapshots = { ...readStoredSnapshots() };

        setUsage(data.usage);

        for (const result of data.results) {
          const destination = destinations.find((item) => item.slug === result.destinationSlug);
          if (!destination) continue;
          const tripWindow = tripWindowFor(destination, activePreferences);
          nextSnapshots[snapshotKey(result.destinationSlug, activePreferences, tripWindow)] = result;
        }

        writeStoredSnapshots(nextSnapshots);
        setSnapshots(nextSnapshots);
        setLodgingUsage(data.usage);
        persistDestinationScenarios(
          data.results
            .filter((result) => result.status === "checked")
            .map((result) => result.destinationSlug),
          activePreferences
        );
        void refreshSavedSearches();
        setStatusMessage(
          data.results.some((result) => result.status === "checked")
            ? "Airfare check complete."
            : "Airfare check finished, but no live fares were returned."
        );
      } catch {
        const nextSnapshots = {
          ...readStoredSnapshots(),
          ...Object.fromEntries(
            Object.entries(unavailableSnapshots(slugs, "Unable to check airfare right now.")).map(
              ([slug, result]) => {
                const destination = destinations.find((item) => item.slug === slug);
                const tripWindow = destination
                  ? tripWindowFor(destination, activePreferences)
                  : { departDate: "", returnDate: "" };
                return [snapshotKey(slug, activePreferences, tripWindow), result];
              }
            )
          )
        };
        writeStoredSnapshots(nextSnapshots);
        setSnapshots(nextSnapshots);
        setStatusMessage("Unable to check airfare right now.");
      } finally {
        setCheckingSlugs((current) => {
          const next = new Set(current);
          slugs.forEach((slug) => next.delete(slug));
          return next;
        });
      }
    },
    [destinations, persistDestinationScenarios, preferences, refreshSavedSearches, snapshotKey, tripWindowFor]
  );

  const refreshLodgingSnapshots = useCallback(
    async (
      slugs: string[],
      options: { manual?: boolean } = {},
      activePreferences: TripPreferences = preferences
    ) => {
      if (!slugs.length) return;

      setCheckingLodgingSlugs((current) => new Set([...current, ...slugs]));
      setLodgingStatusMessage(options.manual ? "Checking lodging now..." : "Checking lodging...");

      try {
        const response = await fetch("/api/lodging/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences: activePreferences, refresh: Boolean(options.manual), slugs })
        });

        if (!response.ok) throw new Error("Unable to refresh lodging snapshots.");
        const data = (await response.json()) as SnapshotResponse;
        const nextSnapshots = { ...readStoredLodgingSnapshots() };

        setLodgingUsage(data.usage);
        setUsage(data.usage);

        for (const result of data.results) {
          const destination = destinations.find((item) => item.slug === result.destinationSlug);
          if (!destination) continue;
          const tripWindow = tripWindowFor(destination, activePreferences);
          nextSnapshots[lodgingKey(destination, activePreferences, tripWindow)] = result;
        }

        writeStoredLodgingSnapshots(nextSnapshots);
        setLodgingSnapshots(nextSnapshots);
        persistDestinationScenarios(
          data.results
            .filter((result) => result.status === "checked")
            .map((result) => result.destinationSlug),
          activePreferences
        );
        void refreshSavedSearches();
        setLodgingStatusMessage(
          data.results.some((result) => result.status === "checked")
            ? "Lodging check complete."
            : "Lodging check finished, but no live prices were returned."
        );
      } catch {
        setLodgingStatusMessage("Unable to check lodging right now.");
      } finally {
        setCheckingLodgingSlugs((current) => {
          const next = new Set(current);
          slugs.forEach((slug) => next.delete(slug));
          return next;
        });
      }
    },
    [destinations, lodgingKey, persistDestinationScenarios, preferences, refreshSavedSearches, tripWindowFor]
  );

  const hydrateScenarioSnapshots = useCallback(
    async (destination: Destination, activePreferences: TripPreferences) => {
      try {
        const fareRequest =
          activePreferences.travelMode === "drive"
            ? Promise.resolve(undefined)
            : fetch("/api/airfare/snapshots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  preferences: activePreferences,
                  refresh: false,
                  slugs: [destination.slug]
                })
              });
        const [fareResponse, lodgingResponse] = await Promise.all([
          fareRequest,
          fetch("/api/lodging/snapshots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              preferences: activePreferences,
              refresh: false,
              slugs: [destination.slug]
            })
          })
        ]);
        const tripWindow = tripWindowFor(destination, activePreferences);

        if (fareResponse?.ok) {
          const data = (await fareResponse.json()) as SnapshotResponse;
          setUsage(data.usage);
          if (data.results.length) {
            const nextSnapshots = { ...readStoredSnapshots() };
            for (const result of data.results) {
              nextSnapshots[snapshotKey(result.destinationSlug, activePreferences, tripWindow)] = result;
            }
            writeStoredSnapshots(nextSnapshots);
            setSnapshots(nextSnapshots);
          }
        }

        if (lodgingResponse.ok) {
          const data = (await lodgingResponse.json()) as SnapshotResponse;
          setLodgingUsage(data.usage);
          setUsage(data.usage);
          if (data.results.length) {
            const nextSnapshots = { ...readStoredLodgingSnapshots() };
            for (const result of data.results) {
              nextSnapshots[lodgingKey(destination, activePreferences, tripWindow)] = result;
            }
            writeStoredLodgingSnapshots(nextSnapshots);
            setLodgingSnapshots(nextSnapshots);
          }
        }
      } catch {
        // Scenario edits can still show unchecked state when D1 is unavailable.
      }
    },
    [lodgingKey, snapshotKey, tripWindowFor]
  );

  const updateCardScenario = useCallback(
    (destination: Destination, nextPreferences: TripPreferences) => {
      setScenarioOverrides((current) => ({
        ...current,
        [destination.slug]: {
          departure: nextPreferences.departure,
          travelMode: nextPreferences.travelMode,
          flightCount: nextPreferences.flightCount,
          nights: nextPreferences.nights,
          lodging: nextPreferences.lodging,
          interests: nextPreferences.interests,
          travelSeason: nextPreferences.travelSeason,
          departDate: nextPreferences.departDate,
          returnDate: nextPreferences.returnDate
        }
      }));
      void fetch("/api/destination-scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationSlug: destination.slug,
          preferences: nextPreferences
        })
      }).catch(() => undefined);
      void hydrateScenarioSnapshots(destination, nextPreferences);
    },
    [hydrateScenarioSnapshots]
  );

  useEffect(() => {
    function handleSavedSearchSelected(event: Event) {
      const savedSearch = (event as CustomEvent<SavedSearchSummary>).detail;
      if (!savedSearch?.destinationSlug) return;

      setFocusedSavedSearch(savedSearch);
      setRegionFilter(allRegionsFilter);
      setTravelFilter(allTravelFilter);
      setScoreSort(noScoreSort);
      setVisibleCount(initialVisibleDestinations);

      const destination = destinations.find(
        (item) => item.slug === savedSearch.destinationSlug
      );
      if (!destination) return;
      const basePreferences = readTripPreferences();
      updateCardScenario(destination, {
        ...basePreferences,
        departure: savedSearch.departure ?? basePreferences.departure,
        travelMode: savedSearch.travelMode ?? basePreferences.travelMode,
        flightCount: savedSearch.flightCount ?? basePreferences.flightCount,
        nights: savedSearch.nights ?? basePreferences.nights,
        lodging: savedSearch.lodging ?? basePreferences.lodging,
        departDate: savedSearch.departDate,
        returnDate: savedSearch.returnDate,
        travelSeason: "saved"
      });
    }

    window.addEventListener(savedSearchSelectedEvent, handleSavedSearchSelected);
    return () => {
      window.removeEventListener(savedSearchSelectedEvent, handleSavedSearchSelected);
    };
  }, [destinations, updateCardScenario]);

  const suggestDestinations = useCallback(async () => {
    setSuggestingDestinations(true);
    setSuggestionStatusMessage("Looking for destination ideas...");

    try {
      const response = await fetch("/api/destinations/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptKind: "more-in-region",
          region: generatorRegion === allRegionsFilter ? undefined : generatorRegion,
          preferences
        })
      });
      const data = (await response.json()) as SuggestionResponse;
      setAiUsage(data.usage);
      setSuggestions(data.suggestions);
      setSuggestionStatusMessage(
        data.message ??
          (response.ok
            ? "Suggested destination ideas saved."
            : "Unable to generate suggestions.")
      );
    } catch {
      setSuggestionStatusMessage("Unable to look for destination ideas right now.");
    } finally {
      setSuggestingDestinations(false);
    }
  }, [generatorRegion, preferences]);

  const reviewSuggestion = useCallback(async (id: string, action: "accept" | "hide") => {
    setReviewingSuggestionId(id);
    setSuggestionStatusMessage(action === "accept" ? "Adding destination idea..." : "Rejecting suggestion...");

    try {
      const response = await fetch("/api/destinations/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action })
      });
      const data = (await response.json()) as SuggestionResponse;
      setAiUsage(data.usage);
      setSuggestions(data.suggestions);
      setSuggestionStatusMessage(
        data.message ?? (response.ok ? "Suggestion updated." : "Unable to update suggestion.")
      );

      if (response.ok && action === "accept") {
        window.location.reload();
      }
    } catch {
      setSuggestionStatusMessage("Unable to update destination ideas right now.");
    } finally {
      setReviewingSuggestionId(null);
    }
  }, []);

  const desktopColumns = visibleDestinations.reduce<Destination[][]>(
    (columns, destination, index) => {
      columns[index % columns.length].push(destination);
      return columns;
    },
    [[], []]
  );

  function renderDestinationCard(destination: Destination) {
    const activePreferences = scenarioPreferences(destination.slug);
    const tripWindow = tripWindowFor(destination, activePreferences);
    const lodgingMode = lodgingModeFromPreference(activePreferences.lodging);
    const fareKey = snapshotKey(destination.slug, activePreferences, tripWindow);
    const activeLodgingKey = lodgingKey(destination, activePreferences, tripWindow);
    const activeLegacyLodgingKey = legacyLodgingKey(destination, activePreferences, tripWindow);
    const isExpanded = expandedDestinationSlugs.has(destination.slug);
    const activeFareSnapshot = snapshots[fareKey] ?? savedSearchSnapshotMaps.fare[fareKey];
    const activeLodgingSnapshot =
      lodgingSnapshots[activeLodgingKey] ??
      lodgingSnapshots[activeLegacyLodgingKey] ??
      savedSearchSnapshotMaps.lodging[activeLodgingKey];
    const hasCheckedScenario =
      activeFareSnapshot?.status === "checked" ||
      activeLodgingSnapshot?.status === "checked";
    const hasCheckedFallback =
      Boolean(savedCheckedScenarios.get(destination.slug)) ||
      Boolean(localCheckedScenarios.get(destination.slug));

    return (
      <DestinationCard
        key={destination.slug}
        destination={destination}
        fareSnapshot={activeFareSnapshot}
        lodgingMode={lodgingMode}
        lodgingSnapshot={activeLodgingSnapshot}
        isCheckingFare={checkingSlugs.has(destination.slug)}
        isCheckingLodging={checkingLodgingSlugs.has(destination.slug)}
        onCheckFare={() =>
          void refreshFareSnapshots([destination.slug], { manual: true }, activePreferences)
        }
        onCheckLodging={() =>
          void refreshLodgingSnapshots([destination.slug], { manual: true }, activePreferences)
        }
        onScenarioChange={(nextPreferences) =>
          updateCardScenario(destination, nextPreferences)
        }
        usage={usage ?? lodgingUsage}
        preferences={activePreferences}
        tripWindow={tripWindow}
        savedSearches={savedSearches}
        isExpanded={isExpanded}
        onExpandedChange={(expanded) => {
          if (!expanded && !hasCheckedScenario && hasCheckedFallback) {
            setScenarioOverrides((current) => {
              const next = { ...current };
              delete next[destination.slug];
              return next;
            });
          }
          setExpandedDestinationSlugs((current) => {
            const next = new Set(current);
            if (expanded) {
              next.add(destination.slug);
            } else {
              next.delete(destination.slug);
            }
            return next;
          });
        }}
        photoUrl={photoOverrides[destination.slug] ?? destination.visualTheme.photoUrl}
        onPhotoChange={(photoUrl) =>
          setPhotoOverrides((current) => ({
            ...current,
            [destination.slug]: photoUrl
          }))
        }
      />
    );
  }

  const selectedNightValue = nightOptions.includes(preferences.nights)
    ? String(preferences.nights)
    : "custom";
  const selectedInterest =
    !customInterestsOpen && interestOptions.includes(preferences.interests)
      ? preferences.interests
      : "custom";
  const generatorFieldClass =
    "mt-1 h-9 w-full rounded-md border border-white/30 bg-white px-2 text-sm font-semibold text-ink outline-none transition focus:border-white/80 focus:ring-2 focus:ring-white/20";
  const libraryFieldClass =
    "h-9 rounded-md border border-ink/12 bg-white px-2 text-sm font-semibold text-ink outline-none transition focus:border-harbor/45";
  const activityStatusMessage = checkingCount
    ? `Checking airfare for ${checkingCount} ${checkingCount === 1 ? "trip" : "trips"}...`
    : checkingLodgingCount
      ? `Checking lodging for ${checkingLodgingCount} ${
          checkingLodgingCount === 1 ? "trip" : "trips"
        }...`
      : [statusMessage, lodgingStatusMessage].filter(Boolean).join(" · ");

  return (
    <>
      <div className="mb-4 rounded-md bg-harbor px-4 py-4 text-white shadow-[0_18px_42px_rgb(43_86_96_/_0.18)] sm:px-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">Trip Ideas</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/72">
              Curated places with enough context to compare costs, dates, scores, and tradeoffs.
            </p>
          </div>
          {aiUsage ? (
            <span className="rounded-full border border-white/18 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/76">
              {aiUsage.remaining}/{aiUsage.limit} left today
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setGeneratorControlsOpen((current) => !current)}
          className="mb-3 flex w-full items-center justify-between rounded-md border border-white/16 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/82 md:hidden"
          aria-expanded={generatorControlsOpen}
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles size={15} aria-hidden="true" />
            Idea Generator
          </span>
          <ChevronDown
            size={16}
            className={`transition ${generatorControlsOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        <div className="mb-3 hidden items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/82 md:inline-flex">
          <Sparkles size={15} aria-hidden="true" />
          Idea Generator
        </div>
        <div className={`${generatorControlsOpen ? "block" : "hidden"} md:block`}>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-md border border-white/16 bg-white/10 px-3 py-2">
              <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/64">
                <Plane size={14} className="text-white/68" aria-hidden="true" />
                Travel
              </span>
              <div className="mt-1 grid h-9 grid-cols-2 rounded-md border border-white/20 bg-white/10 p-0.5">
                {[
                  { value: "fly", label: "Fly", icon: Plane },
                  { value: "drive", label: "Drive", icon: Car }
                ].map((option) => {
                  const Icon = option.icon;
                  const active = (preferences.travelMode ?? "fly") === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        updateGeneratorPreferences({
                          travelMode: option.value as TripPreferences["travelMode"]
                        })
                      }
                      className={`inline-flex items-center justify-center gap-1 rounded-[4px] text-xs font-semibold transition ${
                        active
                          ? "bg-white text-harbor shadow-sm"
                          : "text-white/76 hover:bg-white/10 hover:text-white"
                      }`}
                      aria-pressed={active}
                    >
                      <Icon size={13} aria-hidden="true" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="rounded-md border border-white/16 bg-white/10 px-3 py-2">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/64">
              <MapPin size={14} className="text-white/68" aria-hidden="true" />
              Departure
            </span>
            <input
              className={generatorFieldClass}
              list="generator-departure-airports"
              value={preferences.departure}
              onChange={(event) => updateGeneratorPreferences({ departure: event.target.value })}
            />
            <datalist id="generator-departure-airports">
              {airportOptions.map((airport) => (
                <option
                  key={airport.code}
                  value={airport.code}
                  label={`${airport.code} · ${airport.label}`}
                />
              ))}
            </datalist>
          </label>
          <label className="rounded-md border border-white/16 bg-white/10 px-3 py-2">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/64">
              <Users size={14} className="text-white/68" aria-hidden="true" />
              Travelers
            </span>
            <input
              className={generatorFieldClass}
              type="number"
              min={1}
              max={8}
              value={preferences.flightCount}
              onChange={(event) =>
                updateGeneratorPreferences({ flightCount: Number(event.target.value) })
              }
            />
          </label>
          <label className="rounded-md border border-white/16 bg-white/10 px-3 py-2">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/64">
              <CalendarDays size={14} className="text-white/68" aria-hidden="true" />
              Nights
            </span>
            <select
              className={generatorFieldClass}
              value={customNightsOpen ? "custom" : selectedNightValue}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setCustomNightsOpen(true);
                  return;
                }
                setCustomNightsOpen(false);
                updateGeneratorPreferences({
                  nights: Number(event.target.value),
                  departDate: undefined,
                  returnDate: undefined,
                  travelSeason: "recommended"
                });
              }}
            >
              {nightOptions.map((nights) => (
                <option key={nights} value={nights}>
                  {tripLengthLabel(nights)}
                </option>
              ))}
              <option value="custom">custom</option>
            </select>
            {customNightsOpen ? (
              <input
                className={`${generatorFieldClass} mt-2`}
                type="number"
                min={1}
                max={60}
                value={preferences.nights}
                onChange={(event) =>
                  updateGeneratorPreferences({
                    nights: Number(event.target.value),
                    departDate: undefined,
                    returnDate: undefined,
                    travelSeason: "recommended"
                  })
                }
              />
            ) : null}
          </label>
          <label className="rounded-md border border-white/16 bg-white/10 px-3 py-2">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/64">
              <BedDouble size={14} className="text-white/68" aria-hidden="true" />
              Lodging
            </span>
            <select
              className={generatorFieldClass}
              value={preferences.lodging}
              onChange={(event) => {
                const lodging = event.target.value;
                updateGeneratorPreferences({ lodging });
              }}
            >
              {lodgingOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="rounded-md border border-white/16 bg-white/10 px-3 py-2 xl:col-span-1">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/64">
              <Palette size={14} className="text-white/68" aria-hidden="true" />
              Interests
            </span>
            <select
              className={generatorFieldClass}
              value={selectedInterest}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setCustomInterestsOpen(true);
                  return;
                }
                setCustomInterestsOpen(false);
                updateGeneratorPreferences({ interests: event.target.value });
              }}
            >
              {interestOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {selectedInterest === "custom" ? (
              <input
                className={`${generatorFieldClass} mt-2`}
                value={preferences.interests}
                onChange={(event) =>
                  updateGeneratorPreferences({ interests: event.target.value })
                }
              />
            ) : null}
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="grid min-w-44 gap-1 text-xs text-white/72">
            <span className="font-semibold uppercase tracking-wide text-white/64">Region</span>
            <select
              value={generatorRegion}
              onChange={(event) => setGeneratorRegion(event.target.value)}
              className={generatorFieldClass}
            >
              <option value={allRegionsFilter}>all regions</option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
            </label>
            <button
              type="button"
              onClick={() => void suggestDestinations()}
              disabled={suggestingDestinations || aiUsage?.remaining === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#8fd3ff]/45 bg-[#1f76c2] px-3 text-xs font-semibold text-white shadow-[0_8px_18px_rgb(10_52_92_/_0.22)] transition hover:bg-[#185f9e] disabled:cursor-not-allowed disabled:border-white/20 disabled:bg-white/10 disabled:text-white/36 disabled:shadow-none"
            >
              <Sparkles
                size={14}
                className={suggestingDestinations ? "animate-spin" : "ai-sparkle"}
                aria-hidden="true"
              />
              {suggestingDestinations ? "Suggesting..." : "Suggest ideas"}
            </button>
          </div>
        </div>
      </div>

      {suggestions.length || suggestionStatusMessage ? (
        <div className="mb-3 rounded-md border border-ink/8 bg-white/60 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/38">
              Suggested ideas
            </p>
            {suggestionStatusMessage ? (
              <p className="text-xs font-medium text-ink/54">{suggestionStatusMessage}</p>
            ) : null}
          </div>
          {suggestions.length ? (
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {suggestions.slice(0, 6).map((suggestion) => (
                <article
                  key={suggestion.id}
                  className="rounded-md border border-ink/10 bg-white px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{suggestion.name}</p>
                      <p className="text-xs font-medium text-ink/45">{suggestion.region}</p>
                    </div>
                    <span className="rounded-md bg-harbor/8 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-harbor">
                      Review
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-ink/64">
                    {suggestion.payload.whyItFits}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-ink/45">
                    Best months: {suggestion.payload.bestMonths}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ink/45">
                    Watch: {suggestion.payload.tradeoffs}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void reviewSuggestion(suggestion.id, "accept")}
                      disabled={reviewingSuggestionId === suggestion.id}
                      className="rounded-md border border-harbor/25 bg-harbor px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-harbor/90 disabled:cursor-wait disabled:opacity-60"
                    >
                      Add to ideas
                    </button>
                    <button
                      type="button"
                      onClick={() => void reviewSuggestion(suggestion.id, "hide")}
                      disabled={reviewingSuggestionId === suggestion.id}
                      className="rounded-md border border-ink/12 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink/58 transition hover:border-ink/25 hover:text-ink disabled:cursor-wait disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {activityStatusMessage ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink/8 bg-white/60 px-3 py-2 text-xs text-ink/58">
          <span>{activityStatusMessage}</span>
        </div>
      ) : null}

      <section className="rounded-md border border-ink/8 bg-white/45 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/38">
              Results
            </p>
            <p className="mt-1 text-xs font-semibold text-ink/45">
              Showing {shownCount} of {filteredDestinations.length}
            </p>
          </div>
          {visibleDestinations.length ? (
            <div className="flex flex-wrap gap-2 text-xs text-ink/58">
              <button
                type="button"
                onClick={() =>
                  setExpandedDestinationSlugs(
                    new Set(visibleDestinations.map((destination) => destination.slug))
                  )
                }
                className="rounded-md border border-ink/12 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink/62 transition hover:border-harbor/35 hover:text-harbor"
              >
                Expand all
              </button>
              <button
                type="button"
                onClick={() => setExpandedDestinationSlugs(new Set())}
                className="rounded-md border border-ink/12 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink/62 transition hover:border-harbor/35 hover:text-harbor"
              >
              Collapse all
            </button>
          </div>
        ) : null}
        </div>

        <button
          type="button"
          onClick={() => setResultFiltersOpen((current) => !current)}
          className="mt-3 flex w-full items-center justify-between rounded-md border border-ink/10 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink/56 md:hidden"
          aria-expanded={resultFiltersOpen}
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal size={14} aria-hidden="true" />
            Filters
          </span>
          <ChevronDown
            size={16}
            className={`transition ${resultFiltersOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        <div
          className={`mt-3 flex-wrap items-end gap-3 border-t border-ink/8 pt-3 text-xs text-ink/58 ${
            resultFiltersOpen ? "flex" : "hidden"
          } md:flex`}
        >
          <label className="grid min-w-36 gap-1">
            <span className="font-semibold uppercase tracking-wide text-ink/38">Region</span>
            <select
              value={regionFilter}
              onChange={(event) => setRegionFilter(event.target.value)}
              className={libraryFieldClass}
            >
              <option value={allRegionsFilter}>all regions</option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-52 gap-1">
            <span className="font-semibold uppercase tracking-wide text-ink/38">Interests</span>
            <select
              value={libraryInterestFilter}
              onChange={(event) => setLibraryInterestFilter(event.target.value)}
              className={libraryFieldClass}
            >
              <option value={allInterestsFilter}>all interests</option>
              {libraryInterestOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-40 gap-1">
            <span className="font-semibold uppercase tracking-wide text-ink/38">Travel</span>
            <select
              value={travelFilter}
              onChange={(event) => setTravelFilter(event.target.value)}
              className={libraryFieldClass}
            >
              <option value={allTravelFilter}>fly or drive</option>
              <option value="fly">fly</option>
              <option value="drive">drive</option>
            </select>
          </label>
          <label className="grid min-w-40 gap-1">
            <span className="font-semibold uppercase tracking-wide text-ink/38">Sort by score</span>
            <select
              value={scoreSort}
              onChange={(event) =>
                setScoreSort(event.target.value as keyof Destination["fit"] | typeof noScoreSort)
              }
              className={libraryFieldClass}
            >
              <option value={noScoreSort}>original order</option>
              <option value="art">art</option>
              <option value="gardens">gardens</option>
              <option value="food">food</option>
              <option value="landscape">landscape</option>
            </select>
          </label>
          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setFocusedSavedSearch(null);
                setRegionFilter(allRegionsFilter);
                setLibraryInterestFilter(allInterestsFilter);
                setTravelFilter(allTravelFilter);
                setScoreSort(noScoreSort);
              }}
              className="h-9 rounded-md border border-ink/12 bg-white px-3 text-xs font-semibold text-ink/62 transition hover:border-harbor/35 hover:text-harbor"
            >
              Clear
            </button>
          ) : null}
        </div>

        {focusedSavedSearch ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-harbor/18 bg-harbor/8 px-3 py-2 text-xs text-ink/62">
            <span>
              Viewing saved check:{" "}
              <span className="font-semibold text-ink">
                {focusedSavedSearch.destinationName}
              </span>{" "}
              · {focusedSavedSearch.detail}
            </span>
            <button
              type="button"
              onClick={() => setFocusedSavedSearch(null)}
              className="rounded-md border border-ink/12 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink/62 transition hover:border-harbor/35 hover:text-harbor"
            >
              Show all ideas
            </button>
          </div>
        ) : null}

        <div className="mt-6">
          {visibleDestinations.length ? (
            <>
              <div className="grid gap-6 md:hidden">
                {visibleDestinations.map((destination) => renderDestinationCard(destination))}
              </div>
              <div className="hidden gap-6 md:grid md:grid-cols-2">
                {desktopColumns.map((column, index) => (
                  <div key={index} className="min-w-0">
                    {column.map((destination) => renderDestinationCard(destination))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-md border border-ink/8 bg-white/60 px-4 py-8 text-center text-sm font-medium text-ink/54">
              No destinations match the current region, transport, and interest settings.
            </div>
          )}
        </div>

        {hasMoreDestinations ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm">
            <button
              type="button"
              onClick={() =>
                setVisibleCount((current) =>
                  Math.min(current + destinationPageSize, filteredDestinations.length)
                )
              }
              className="rounded-md border border-ink/15 bg-white px-4 py-2 font-semibold text-ink shadow-sm transition hover:border-ink/30 hover:bg-ink/[0.03]"
            >
              Show more ideas
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}
