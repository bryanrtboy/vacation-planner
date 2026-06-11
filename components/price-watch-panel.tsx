"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import type { UsageState, WatchedSearch, WatchRefreshResult } from "@/lib/types";

const storageKey = "artist-travel-finder:watches";

type RefreshResponse = {
  usage: UsageState;
  staleAfterHours: number;
  maxWatchedDestinations: number;
  results: WatchRefreshResult[];
};

function readWatches(): WatchedSearch[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WatchedSearch[];
  } catch {
    return [];
  }
}

function writeWatches(watches: WatchedSearch[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(watches));
  window.dispatchEvent(new CustomEvent("artist-travel-finder:watches-changed"));
  void fetch("/api/watches", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ watches })
  }).catch(() => undefined);
}

function rangeLabel(range?: { min: number; max: number }) {
  if (!range) return "Unavailable";
  return `$${range.min.toLocaleString()}-$${range.max.toLocaleString()}`;
}

export function PriceWatchPanel() {
  const [watches, setWatches] = useState<WatchedSearch[]>([]);
  const [results, setResults] = useState<WatchRefreshResult[]>([]);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function sync() {
      setWatches(readWatches());
    }

    sync();
    fetch("/api/watches")
      .then((response) => response.json())
      .then((data: { watches?: WatchedSearch[] }) => {
        if (!data.watches?.length) return;
        window.localStorage.setItem(storageKey, JSON.stringify(data.watches));
        window.dispatchEvent(new CustomEvent("artist-travel-finder:watches-changed"));
        setWatches(data.watches);
      })
      .catch(() => undefined);

    window.addEventListener("artist-travel-finder:watches-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("artist-travel-finder:watches-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    fetch("/api/price-watch/refresh")
      .then((response) => response.json())
      .then((data: { usage: UsageState }) => setUsage(data.usage))
      .catch(() => setUsage(null));
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");

    const response = await fetch("/api/price-watch/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searches: watches })
    });

    if (!response.ok) {
      setError("Unable to refresh watched fares.");
      setLoading(false);
      return;
    }

    const data = (await response.json()) as RefreshResponse;
    setResults(data.results);
    setUsage(data.usage);

    const byId = new Map(data.results.map((result) => [result.id, result]));
    const updatedWatches = watches.map((watch) => {
      const result = byId.get(watch.id);
      if (!result || result.status !== "checked") return watch;
      return {
        ...watch,
        lastCheckedAt: result.retrievedAt,
        lastRange: result.currentRange,
        lastProvider: result.provider,
        lastSampledDates: result.sampledDates,
        lastSourceUrl: result.sourceUrl,
        lastSourceDetail: result.sourceDetail,
        lastSourceKind: result.sourceKind
      };
    });

    writeWatches(updatedWatches);
    setLoading(false);
  }

  function clearWatch(id: string) {
    writeWatches(watches.filter((watch) => watch.id !== id));
    setResults(results.filter((result) => result.id !== id));
  }

  return (
    <aside className="rounded-md border border-ink/8 bg-white/50 px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/58">
          <Eye size={15} className="text-harbor" aria-hidden="true" />
          Watchlist
        </span>
        <span className="text-xs text-ink/42">
          {watches.length ? `${watches.length} watching` : "none yet"} ·{" "}
          {usage ? `${usage.remaining}/${usage.limit} checks left` : "cap loading"}
        </span>

        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {watches.length === 0 ? (
            <span className="rounded-md bg-paper/70 px-2 py-1 text-xs text-ink/38">
              Add only trips you are actively considering.
            </span>
          ) : (
            watches.slice(0, 4).map((watch) => {
              const result = results.find((item) => item.id === watch.id);
              return (
                <span
                  key={watch.id}
                  className="inline-flex items-center gap-1.5 rounded-md bg-paper/80 px-2 py-1 text-xs text-ink/64"
                >
                  <span className="font-semibold text-ink/78">{watch.destinationName}</span>
                  <span>{rangeLabel(result?.currentRange ?? watch.lastRange)}</span>
                  <button
                    type="button"
                    onClick={() => clearWatch(watch.id)}
                    className="rounded-sm text-ink/38 transition hover:text-clay"
                    title="Stop watching"
                  >
                    <EyeOff size={12} aria-hidden="true" />
                  </button>
                </span>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading || watches.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/82 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-harbor disabled:cursor-not-allowed disabled:bg-ink/8 disabled:text-ink/28"
        >
          <RefreshCw size={13} aria-hidden="true" className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error ? <p className="mt-1 text-xs text-clay">{error}</p> : null}
    </aside>
  );
}
