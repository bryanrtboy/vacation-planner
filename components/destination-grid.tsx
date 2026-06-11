"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DestinationCard } from "@/components/destination-card";
import {
  defaultTripPreferences,
  readTripPreferences,
  recommendedTripWindow,
  tripPreferencesChangedEvent
} from "@/lib/trip-preferences";
import type { Destination, UsageState, WatchRefreshResult } from "@/lib/types";
import type { TripPreferences } from "@/lib/types";

const fareSnapshotStorageKey = "artist-travel-finder:fare-snapshots";
type StoredFareSnapshots = Record<string, WatchRefreshResult>;

type SnapshotResponse = {
  usage: UsageState;
  staleAfterHours: number;
  results: WatchRefreshResult[];
};

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
  const [preferences, setPreferences] = useState<TripPreferences>(defaultTripPreferences);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [checkingSlugs, setCheckingSlugs] = useState<Set<string>>(() => new Set());
  const [statusMessage, setStatusMessage] = useState("");
  const destinationSlugs = useMemo(
    () => destinations.map((destination) => destination.slug),
    [destinations]
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
  const checkingCount = checkingSlugs.size;
  const checkedCount = destinationSlugs.filter(
    (slug) => snapshots[snapshotKey(slug)]?.status === "checked"
  ).length;
  const unavailableCount = destinationSlugs.filter((slug) => {
    const snapshot = snapshots[snapshotKey(slug)];
    return snapshot && snapshot.status !== "checked";
  }).length;

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

  const refreshFareSnapshots = useCallback(
    async (slugs: string[], options: { manual?: boolean } = {}) => {
      if (!slugs.length) return;

      setCheckingSlugs((current) => new Set([...current, ...slugs]));
      setStatusMessage(options.manual ? "Checking airfare now..." : "Checking airfare...");

      try {
        const response = await fetch("/api/airfare/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences, slugs })
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

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink/8 bg-white/60 px-3 py-2 text-xs text-ink/58">
        <span>
          {checkingCount
            ? `Checking airfare for ${checkingCount} ${checkingCount === 1 ? "trip" : "trips"}...`
            : statusMessage ||
              `Airfare checks run only when you click Check now · ${checkedCount} live fare${
                checkedCount === 1 ? "" : "s"
              } · ${unavailableCount} unavailable`}
          {usage ? ` · ${usage.remaining}/${usage.limit} checks left` : ""}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {destinations.map((destination) => (
          <DestinationCard
            key={destination.slug}
            destination={destination}
            fareSnapshot={snapshots[snapshotKey(destination.slug)]}
            isCheckingFare={checkingSlugs.has(destination.slug)}
            onCheckFare={() => void refreshFareSnapshots([destination.slug], { manual: true })}
            preferences={preferences}
            tripWindow={tripWindows[destination.slug]}
          />
        ))}
      </div>
    </>
  );
}
