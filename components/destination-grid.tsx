"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DestinationCard } from "@/components/destination-card";
import type { Destination, UsageState, WatchRefreshResult } from "@/lib/types";

const fareSnapshotStorageKey = "artist-travel-finder:fare-snapshots";
const fallbackStaleAfterHours = 24;

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

function isFresh(snapshot: WatchRefreshResult | undefined, staleAfterHours: number) {
  if (!snapshot?.retrievedAt) return false;
  const retrievedAt = new Date(snapshot.retrievedAt).getTime();
  if (Number.isNaN(retrievedAt)) return false;
  const ageHours = (Date.now() - retrievedAt) / (1000 * 60 * 60);
  return ageHours < staleAfterHours;
}

export function DestinationGrid({ destinations }: { destinations: Destination[] }) {
  const [snapshots, setSnapshots] = useState<StoredFareSnapshots>(readStoredSnapshots);
  const [staleAfterHours, setStaleAfterHours] = useState(fallbackStaleAfterHours);
  const requestedSlugsRef = useRef(new Set<string>());
  const destinationSlugs = useMemo(
    () => destinations.map((destination) => destination.slug),
    [destinations]
  );

  useEffect(() => {
    const missingSlugs = destinationSlugs.filter(
      (slug) => !isFresh(snapshots[slug], staleAfterHours) && !requestedSlugsRef.current.has(slug)
    );
    if (!missingSlugs.length) return;

    let cancelled = false;
    missingSlugs.forEach((slug) => requestedSlugsRef.current.add(slug));

    fetch("/api/airfare/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs: missingSlugs })
    })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to refresh airfare snapshots.");
        return response.json() as Promise<SnapshotResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setStaleAfterHours(data.staleAfterHours);
        const nextSnapshots = { ...readStoredSnapshots() };

        for (const result of data.results) {
          nextSnapshots[result.destinationSlug] = result;
        }

        writeStoredSnapshots(nextSnapshots);
        setSnapshots(nextSnapshots);
      })
      .catch(() => {
        if (cancelled) return;
        const nextSnapshots = {
          ...readStoredSnapshots(),
          ...unavailableSnapshots(missingSlugs, "Unable to connect to the airfare snapshot API.")
        };
        writeStoredSnapshots(nextSnapshots);
        setSnapshots(nextSnapshots);
      });

    return () => {
      cancelled = true;
    };
  }, [destinationSlugs, snapshots, staleAfterHours]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {destinations.map((destination) => (
        <DestinationCard
          key={destination.slug}
          destination={destination}
          fareSnapshot={snapshots[destination.slug]}
        />
      ))}
    </div>
  );
}
