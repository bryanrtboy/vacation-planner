import type { WatchedSearch } from "@/lib/types";

export type PriceSnapshotKind = "airfare" | "lodging";

export type PriceSnapshotSearch = {
  kind: PriceSnapshotKind;
  provider: string;
  destinationSlug: string;
  destinationName: string;
  origin?: string;
  destinationQuery?: string;
  departDate?: string;
  returnDate?: string;
  mode?: string;
  adults?: number;
  children?: number;
};

function normalizePart(value: string | number | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function buildPriceSnapshotKey(search: PriceSnapshotSearch) {
  return [
    search.kind,
    search.provider,
    search.destinationSlug,
    search.origin,
    search.destinationQuery,
    search.departDate,
    search.returnDate,
    search.mode,
    search.adults,
    search.children
  ]
    .map(normalizePart)
    .join("|");
}

export function airfareSnapshotSearch(search: WatchedSearch): PriceSnapshotSearch {
  return {
    kind: "airfare",
    provider: "serpapi-google-flights",
    destinationSlug: search.destinationSlug,
    destinationName: search.destinationName,
    origin: search.origin,
    destinationQuery: search.route,
    departDate: search.departDate,
    returnDate: search.returnDate,
    adults: 1,
    children: 0
  };
}
