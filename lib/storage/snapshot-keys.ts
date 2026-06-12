import type { WatchedSearch } from "@/lib/types";
import type { Destination, TripWindow } from "@/lib/types";
import type { LodgingMode } from "@/lib/lodging/modes";
import { lodgingSearchQuery } from "@/lib/lodging/modes";

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
    adults: search.adults ?? 1,
    children: 0
  };
}

export function lodgingSnapshotSearch(
  destination: Destination,
  tripWindow: TripWindow,
  mode: LodgingMode
): PriceSnapshotSearch {
  return {
    kind: "lodging",
    provider: "serpapi-google-hotels-v7",
    destinationSlug: destination.slug,
    destinationName: destination.name,
    destinationQuery: lodgingSearchQuery(destination, mode),
    departDate: tripWindow.departDate,
    returnDate: tripWindow.returnDate,
    mode: mode.id,
    adults: mode.adults,
    children: 0
  };
}
