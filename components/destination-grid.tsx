"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DestinationCard } from "@/components/destination-card";
import { lodgingModeFromPreference, lodgingSnapshotKey } from "@/lib/lodging/modes";
import {
  defaultTripPreferences,
  readTripPreferences,
  recommendedTripWindow,
  tripPreferencesChangedEvent
} from "@/lib/trip-preferences";
import type { Destination, UsageState, WatchRefreshResult } from "@/lib/types";
import type { TripPreferences } from "@/lib/types";

const fareSnapshotStorageKey = "artist-travel-finder:fare-snapshots";
const lodgingSnapshotStorageKey = "artist-travel-finder:lodging-snapshots";
const initialVisibleDestinations = 4;
const destinationPageSize = 4;
const allRegionsFilter = "all";
const allTransportFilter = "all";
const noScoreSort = "none";
type StoredFareSnapshots = Record<string, WatchRefreshResult>;

type SnapshotResponse = {
  usage: UsageState;
  results: WatchRefreshResult[];
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
  const [regionFilter, setRegionFilter] = useState(allRegionsFilter);
  const [transportFilter, setTransportFilter] = useState(allTransportFilter);
  const [scoreSort, setScoreSort] = useState<keyof Destination["fit"] | typeof noScoreSort>(
    noScoreSort
  );
  const [visibleCount, setVisibleCount] = useState(initialVisibleDestinations);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [lodgingUsage, setLodgingUsage] = useState<UsageState | null>(null);
  const [checkingSlugs, setCheckingSlugs] = useState<Set<string>>(() => new Set());
  const [checkingLodgingSlugs, setCheckingLodgingSlugs] = useState<Set<string>>(() => new Set());
  const [statusMessage, setStatusMessage] = useState("");
  const [lodgingStatusMessage, setLodgingStatusMessage] = useState("");
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
  }, [destinations, preferences.interests, regionFilter, scoreSort, transportFilter]);
  const visibleDestinations = useMemo(
    () => filteredDestinations.slice(0, visibleCount),
    [filteredDestinations, visibleCount]
  );
  const visibleDestinationSlugs = useMemo(
    () => visibleDestinations.map((destination) => destination.slug),
    [visibleDestinations]
  );
  const tripWindows = useMemo(
    () =>
      Object.fromEntries(
        destinations.map((destination) => [
          destination.slug,
          recommendedTripWindow(destination, preferences.nights)
        ])
      ),
    [destinations, preferences.nights]
  );
  const snapshotKey = useCallback(
    (slug: string) => {
      const tripWindow = tripWindows[slug];
      return `${slug}:${preferences.departure}:${tripWindow?.departDate}:${tripWindow?.returnDate}`;
    },
    [preferences.departure, tripWindows]
  );
  const lodgingMode = useMemo(
    () => lodgingModeFromPreference(preferences.lodging),
    [preferences.lodging]
  );
  const lodgingKey = useCallback(
    (destination: Destination) => {
      const tripWindow = tripWindows[destination.slug];
      return lodgingSnapshotKey(destination, tripWindow, lodgingMode);
    },
    [lodgingMode, tripWindows]
  );
  const checkingCount = checkingSlugs.size;
  const checkingLodgingCount = checkingLodgingSlugs.size;
  const visibleCheckedCount = visibleDestinationSlugs.filter(
    (slug) => snapshots[snapshotKey(slug)]?.status === "checked"
  ).length;
  const visibleUnavailableCount = visibleDestinationSlugs.filter((slug) => {
    const snapshot = snapshots[snapshotKey(slug)];
    return snapshot && snapshot.status !== "checked";
  }).length;
  const shownCount = Math.min(visibleCount, filteredDestinations.length);
  const hasMoreDestinations = visibleCount < filteredDestinations.length;
  const filtersActive =
    regionFilter !== allRegionsFilter ||
    transportFilter !== allTransportFilter ||
    scoreSort !== noScoreSort;

  useEffect(() => {
    function syncPreferences() {
      setPreferences(readTripPreferences());
    }

    syncPreferences();
    window.addEventListener(tripPreferencesChangedEvent, syncPreferences);
    window.addEventListener("storage", syncPreferences);
    return () => {
      window.removeEventListener(tripPreferencesChangedEvent, syncPreferences);
      window.removeEventListener("storage", syncPreferences);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateCachedSnapshots() {
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
          nextSnapshots[snapshotKey(result.destinationSlug)] = result;
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
  }, [destinationSlugs, preferences, snapshotKey]);

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
          nextSnapshots[lodgingKey(destination)] = result;
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
  }, [destinationSlugs, destinations, lodgingKey, preferences]);

  const refreshFareSnapshots = useCallback(
    async (slugs: string[], options: { manual?: boolean } = {}) => {
      if (!slugs.length) return;

      setCheckingSlugs((current) => new Set([...current, ...slugs]));
      setStatusMessage(options.manual ? "Checking airfare now..." : "Checking airfare...");

      try {
        const response = await fetch("/api/airfare/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences, refresh: Boolean(options.manual), slugs })
        });

        if (!response.ok) throw new Error("Unable to refresh airfare snapshots.");
        const data = (await response.json()) as SnapshotResponse;
        const nextSnapshots = { ...readStoredSnapshots() };

        setUsage(data.usage);

        for (const result of data.results) {
          nextSnapshots[snapshotKey(result.destinationSlug)] = result;
        }

        writeStoredSnapshots(nextSnapshots);
        setSnapshots(nextSnapshots);
        setLodgingUsage(data.usage);
        setStatusMessage(
          data.results.some((result) => result.status === "checked")
            ? "Airfare check complete."
            : "Airfare check finished, but no live fares were returned."
        );
      } catch {
        const nextSnapshots = {
          ...readStoredSnapshots(),
          ...Object.fromEntries(
            Object.entries(unavailableSnapshots(slugs, "Unable to connect to the airfare snapshot API.")).map(
              ([slug, result]) => [snapshotKey(slug), result]
            )
          )
        };
        writeStoredSnapshots(nextSnapshots);
        setSnapshots(nextSnapshots);
        setStatusMessage("Unable to connect to the airfare snapshot API.");
      } finally {
        setCheckingSlugs((current) => {
          const next = new Set(current);
          slugs.forEach((slug) => next.delete(slug));
          return next;
        });
      }
    },
    [preferences, snapshotKey]
  );

  const refreshLodgingSnapshots = useCallback(
    async (slugs: string[], options: { manual?: boolean } = {}) => {
      if (!slugs.length) return;

      setCheckingLodgingSlugs((current) => new Set([...current, ...slugs]));
      setLodgingStatusMessage(options.manual ? "Checking lodging now..." : "Checking lodging...");

      try {
        const response = await fetch("/api/lodging/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences, refresh: Boolean(options.manual), slugs })
        });

        if (!response.ok) throw new Error("Unable to refresh lodging snapshots.");
        const data = (await response.json()) as SnapshotResponse;
        const nextSnapshots = { ...readStoredLodgingSnapshots() };

        setLodgingUsage(data.usage);
        setUsage(data.usage);

        for (const result of data.results) {
          const destination = destinations.find((item) => item.slug === result.destinationSlug);
          if (!destination) continue;
          nextSnapshots[lodgingKey(destination)] = result;
        }

        writeStoredLodgingSnapshots(nextSnapshots);
        setLodgingSnapshots(nextSnapshots);
        setLodgingStatusMessage(
          data.results.some((result) => result.status === "checked")
            ? "Lodging check complete."
            : "Lodging check finished, but no live prices were returned."
        );
      } catch {
        setLodgingStatusMessage("Unable to connect to the lodging snapshot API.");
      } finally {
        setCheckingLodgingSlugs((current) => {
          const next = new Set(current);
          slugs.forEach((slug) => next.delete(slug));
          return next;
        });
      }
    },
    [destinations, lodgingKey, preferences]
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-md border border-ink/8 bg-white/60 px-3 py-3 text-xs text-ink/58">
        <label className="grid min-w-36 gap-1">
          <span className="font-semibold uppercase tracking-wide text-ink/38">Region</span>
          <select
            value={regionFilter}
            onChange={(event) => setRegionFilter(event.target.value)}
            className="h-9 rounded-md border border-ink/12 bg-white px-2 text-sm font-semibold text-ink outline-none transition focus:border-harbor/45"
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
            className="h-9 rounded-md border border-ink/12 bg-white px-2 text-sm font-semibold text-ink outline-none transition focus:border-harbor/45"
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
            className="h-9 rounded-md border border-ink/12 bg-white px-2 text-sm font-semibold text-ink outline-none transition focus:border-harbor/45"
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

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink/8 bg-white/60 px-3 py-2 text-xs text-ink/58">
        <span>
          {checkingCount
            ? `Checking airfare for ${checkingCount} ${checkingCount === 1 ? "trip" : "trips"}...`
            : checkingLodgingCount
              ? `Checking lodging for ${checkingLodgingCount} ${
              checkingLodgingCount === 1 ? "trip" : "trips"
                }...`
            : statusMessage ||
              `Airfare checks run only when you click Check now · ${visibleCheckedCount} live fare${
                visibleCheckedCount === 1 ? "" : "s"
              } shown · ${visibleUnavailableCount} unavailable shown`}
          {lodgingStatusMessage ? ` · ${lodgingStatusMessage}` : ""}
        </span>
      </div>

      {visibleDestinations.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleDestinations.map((destination) => (
            <DestinationCard
              key={destination.slug}
              destination={destination}
              fareSnapshot={snapshots[snapshotKey(destination.slug)]}
              lodgingMode={lodgingMode}
              lodgingSnapshot={lodgingSnapshots[lodgingKey(destination)]}
              isCheckingFare={checkingSlugs.has(destination.slug)}
              isCheckingLodging={checkingLodgingSlugs.has(destination.slug)}
              onCheckFare={() => void refreshFareSnapshots([destination.slug], { manual: true })}
              onCheckLodging={() =>
                void refreshLodgingSnapshots([destination.slug], { manual: true })
              }
              usage={usage ?? lodgingUsage}
              preferences={preferences}
              tripWindow={tripWindows[destination.slug]}
            />
          ))}
        </div>
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
