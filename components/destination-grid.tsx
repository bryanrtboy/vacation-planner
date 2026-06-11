"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BedDouble, CalendarDays, Car, MapPin, Palette, Plane, Sparkles, Users } from "lucide-react";
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
const allTransportFilter = "all";
const noScoreSort = "none";

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
  const [customNightsOpen, setCustomNightsOpen] = useState(false);
  const [customInterestsOpen, setCustomInterestsOpen] = useState(false);
  const [regionFilter, setRegionFilter] = useState(allRegionsFilter);
  const [transportFilter, setTransportFilter] = useState(allTransportFilter);
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
    () => [...new Set(destinations.map((destination) => destination.region))].sort(),
    [destinations]
  );
  const transportModes = useMemo(
    () => [...new Set(destinations.map((destination) => destination.transport))].sort(),
    [destinations]
  );
  const filteredDestinations = useMemo(() => {
    if (focusedSavedSearch) {
      return destinations.filter(
        (destination) => destination.slug === focusedSavedSearch.destinationSlug
      );
    }

    const filtered = destinations.filter((destination) => {
      const regionMatches =
        regionFilter === allRegionsFilter || destination.region === regionFilter;
      const transportMatches =
        transportFilter === allTransportFilter || destination.transport === transportFilter;
      const interestMatches = destinationMatchesInterests(destination, preferences.interests);
      return regionMatches && transportMatches && interestMatches;
    });

    if (scoreSort === noScoreSort) return filtered;

    return [...filtered].sort((a, b) => {
      const scoreDelta = b.fit[scoreSort] - a.fit[scoreSort];
      return scoreDelta || a.name.localeCompare(b.name);
    });
  }, [
    destinations,
    focusedSavedSearch,
    preferences.interests,
    regionFilter,
    scoreSort,
    transportFilter
  ]);
  const visibleDestinations = useMemo(
    () => filteredDestinations.slice(0, visibleCount),
    [filteredDestinations, visibleCount]
  );
  const scenarioPreferences = useCallback(
    (slug: string) => ({
      ...preferences,
      ...scenarioOverrides[slug]
    }),
    [preferences, scenarioOverrides]
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
  const checkingCount = checkingSlugs.size;
  const checkingLodgingCount = checkingLodgingSlugs.size;
  const shownCount = Math.min(visibleCount, filteredDestinations.length);
  const hasMoreDestinations = visibleCount < filteredDestinations.length;
  const filtersActive =
    regionFilter !== allRegionsFilter ||
    transportFilter !== allTransportFilter ||
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
    [destinations, preferences, refreshSavedSearches, snapshotKey, tripWindowFor]
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
    [destinations, lodgingKey, preferences, refreshSavedSearches, tripWindowFor]
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
      setTransportFilter(allTransportFilter);
      setScoreSort(noScoreSort);
      setVisibleCount(initialVisibleDestinations);

      const destination = destinations.find(
        (item) => item.slug === savedSearch.destinationSlug
      );
      if (!destination) return;
      updateCardScenario(destination, readTripPreferences());
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
    const isExpanded = expandedDestinationSlugs.has(destination.slug);

    return (
      <DestinationCard
        key={destination.slug}
        destination={destination}
        fareSnapshot={snapshots[fareKey]}
        lodgingMode={lodgingMode}
        lodgingSnapshot={lodgingSnapshots[activeLodgingKey]}
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
        onExpandedChange={(expanded) =>
          setExpandedDestinationSlugs((current) => {
            const next = new Set(current);
            if (expanded) {
              next.add(destination.slug);
            } else {
              next.delete(destination.slug);
            }
            return next;
          })
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
    "mt-1 h-9 w-full rounded-md border border-ink/12 bg-white px-2 text-sm font-semibold text-ink outline-none transition focus:border-clay/45";
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
      <div className="mb-4 rounded-md border border-clay/20 bg-clay/[0.035] px-3 py-3 shadow-[0_10px_28px_rgb(112_62_38_/_0.08)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-clay">
            <Sparkles size={15} aria-hidden="true" />
            Idea Generator
          </span>
          {aiUsage ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/34">
              {aiUsage.remaining}/{aiUsage.limit} left today
            </span>
          ) : null}
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-md border border-clay/12 bg-white/72 px-3 py-2">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink/38">
              <Plane size={14} className="text-clay/72" aria-hidden="true" />
              Travel
            </span>
            <div className="mt-1 grid h-9 grid-cols-2 rounded-md border border-ink/12 bg-white p-0.5">
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
                        ? "bg-clay text-white"
                        : "text-ink/58 hover:bg-ink/[0.04] hover:text-ink"
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
          <label className="rounded-md border border-clay/12 bg-white/72 px-3 py-2">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink/38">
              <MapPin size={14} className="text-clay/72" aria-hidden="true" />
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
          <label className="rounded-md border border-clay/12 bg-white/72 px-3 py-2">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink/38">
              <Users size={14} className="text-clay/72" aria-hidden="true" />
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
          <label className="rounded-md border border-clay/12 bg-white/72 px-3 py-2">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink/38">
              <CalendarDays size={14} className="text-clay/72" aria-hidden="true" />
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
                updateGeneratorPreferences({ nights: Number(event.target.value) });
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
                  updateGeneratorPreferences({ nights: Number(event.target.value) })
                }
              />
            ) : null}
          </label>
          <label className="rounded-md border border-clay/12 bg-white/72 px-3 py-2">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink/38">
              <BedDouble size={14} className="text-clay/72" aria-hidden="true" />
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
          <label className="rounded-md border border-clay/12 bg-white/72 px-3 py-2 xl:col-span-1">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink/38">
              <Palette size={14} className="text-clay/72" aria-hidden="true" />
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
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="grid min-w-44 gap-1 text-xs text-ink/58">
            <span className="font-semibold uppercase tracking-wide text-ink/38">Region</span>
            <select
              value={generatorRegion}
              onChange={(event) => setGeneratorRegion(event.target.value)}
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
          <button
            type="button"
            onClick={() => void suggestDestinations()}
            disabled={suggestingDestinations || aiUsage?.remaining === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-clay bg-clay px-3 text-xs font-semibold text-white transition hover:bg-clay/90 disabled:cursor-not-allowed disabled:border-ink/10 disabled:bg-ink/5 disabled:text-ink/30"
          >
            <Sparkles size={14} aria-hidden="true" />
            {suggestingDestinations ? "Suggesting..." : "Suggest ideas"}
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-md border border-ink/8 bg-white/45 px-3 py-2 text-xs text-ink/58">
        <label className="grid min-w-36 gap-1">
          <span className="font-semibold uppercase tracking-wide text-ink/38">Library region</span>
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
        <label className="grid min-w-40 gap-1">
          <span className="font-semibold uppercase tracking-wide text-ink/38">Transport</span>
          <select
            value={transportFilter}
            onChange={(event) => setTransportFilter(event.target.value)}
            className={libraryFieldClass}
          >
            <option value={allTransportFilter}>all transport</option>
            {transportModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
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
              setTransportFilter(allTransportFilter);
              setScoreSort(noScoreSort);
            }}
            className="h-9 rounded-md border border-ink/12 bg-white px-3 text-xs font-semibold text-ink/62 transition hover:border-harbor/35 hover:text-harbor"
          >
            Clear
          </button>
        ) : null}
      </div>

      {focusedSavedSearch ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-harbor/18 bg-harbor/8 px-3 py-2 text-xs text-ink/62">
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

      {visibleDestinations.length ? (
        <div className="mb-5 flex flex-wrap items-center justify-end gap-2 text-xs text-ink/58">
          <span className="flex flex-wrap gap-2">
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
          </span>
        </div>
      ) : null}

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
          <span className="text-xs font-semibold text-ink/45">
            Showing {shownCount} of {filteredDestinations.length}
          </span>
        </div>
      ) : null}
    </>
  );
}
