import { getD1Database, nowIso } from "@/lib/storage/cloudflare";
import { buildPriceSnapshotKey, type PriceSnapshotSearch } from "@/lib/storage/snapshot-keys";
import type { PriceSourceKind, SavedSearchSummary, WatchRefreshResult } from "@/lib/types";

type PriceSnapshotRow = {
  snapshot_key: string;
  kind: string;
  provider: string;
  travel_mode: "fly" | "drive" | null;
  mode: string | null;
  destination_slug: string;
  destination_name: string;
  origin: string | null;
  destination_query: string | null;
  depart_date: string | null;
  return_date: string | null;
  adults: number | null;
  children: number | null;
  status: WatchRefreshResult["status"];
  message: string;
  min_price: number | null;
  max_price: number | null;
  sampled_dates: string | null;
  retrieved_at: string | null;
  source_url: string | null;
  source_detail: string | null;
  source_kind: PriceSourceKind;
  raw_provider_json: string | null;
};

type SavedSearchRow = {
  snapshot_key: string;
  kind: "airfare" | "lodging";
  travel_mode: "fly" | "drive" | null;
  mode: string | null;
  destination_slug: string;
  destination_name: string;
  origin: string | null;
  depart_date: string | null;
  return_date: string | null;
  adults: number | null;
  updated_at: string;
};

function isFresh(retrievedAt: string | undefined, staleAfterHours: number) {
  if (!retrievedAt) return false;
  const checkedAt = new Date(retrievedAt).getTime();
  if (Number.isNaN(checkedAt)) return false;
  const ageHours = (Date.now() - checkedAt) / (1000 * 60 * 60);
  return ageHours < staleAfterHours;
}

function rowToResult(row: PriceSnapshotRow): WatchRefreshResult {
  const hasRange = typeof row.min_price === "number" && typeof row.max_price === "number";

  return {
    id: row.snapshot_key,
    destinationSlug: row.destination_slug,
    destinationName: row.destination_name,
    status: row.status,
    message:
      row.status === "checked"
        ? `Saved ${row.kind} quote from a previous check.`
        : row.message,
    currentRange: hasRange ? { min: row.min_price!, max: row.max_price! } : undefined,
    sampledDates: row.sampled_dates ?? undefined,
    retrievedAt: row.retrieved_at ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    sourceDetail: row.source_detail ?? undefined,
    sourceKind: row.status === "checked" ? "cached" : row.source_kind,
    provider: row.provider
  };
}

function shortDate(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function nightsBetween(departDate: string | null, returnDate: string | null) {
  if (!departDate || !returnDate) return undefined;
  const start = new Date(`${departDate}T00:00:00Z`).getTime();
  const end = new Date(`${returnDate}T00:00:00Z`).getTime();
  const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Number.isFinite(nights) && nights > 0 ? nights : undefined;
}

function lodgingPreference(mode: string | null) {
  if (mode === "hotel") return "hotels";
  if (mode === "group-house") return "group house rentals";
  if (mode === "apartment") return "apartments for 2";
  return undefined;
}

function travelModeFromRow(row: { kind: "airfare" | "lodging"; travel_mode: string | null }) {
  if (row.travel_mode === "drive") return "drive";
  if (row.travel_mode === "fly") return "fly";
  return row.kind === "airfare" ? "fly" : undefined;
}

function rowToSavedSearch(row: SavedSearchRow): SavedSearchSummary {
  const nights = nightsBetween(row.depart_date, row.return_date);
  const dateLabel =
    row.depart_date && row.return_date ? `${shortDate(row.depart_date)}-${shortDate(row.return_date)}` : "saved dates";
  const peopleLabel = row.adults
    ? `${row.adults} ${row.kind === "airfare" ? (row.adults === 1 ? "ticket" : "tickets") : row.adults === 1 ? "guest" : "guests"}`
    : "saved people";
  const lodging = lodgingPreference(row.mode);
  const travelMode = travelModeFromRow(row);
  const labelParts =
    row.kind === "airfare"
      ? [
          row.destination_name,
          row.origin ?? "saved origin",
          peopleLabel,
          `${nights ?? "?"} nights`
        ]
      : [
          row.destination_name,
          travelMode === "drive" ? "driving" : undefined,
          lodging ?? "lodging",
          peopleLabel,
          `${nights ?? "?"} nights`
        ].filter(Boolean);

  return {
    id: row.snapshot_key,
    label: labelParts.join(" · "),
    detail:
      row.kind === "airfare"
        ? `Airfare checked ${dateLabel}`
        : `${travelMode === "drive" ? "Driving · " : ""}${lodging ?? "lodging"} checked ${dateLabel}`,
    kind: row.kind,
    travelMode,
    destinationSlug: row.destination_slug,
    destinationName: row.destination_name,
    departure: row.origin ?? undefined,
    flightCount: row.adults ?? undefined,
    nights,
    lodging,
    departDate: row.depart_date ?? undefined,
    returnDate: row.return_date ?? undefined,
    updatedAt: row.updated_at
  };
}

export async function readPriceSnapshot(
  search: PriceSnapshotSearch,
  staleAfterHours?: number
): Promise<WatchRefreshResult | null> {
  const db = await getD1Database();
  if (!db) return null;

  const key = buildPriceSnapshotKey(search);
  const row = await db
    .prepare("SELECT * FROM price_snapshots WHERE snapshot_key = ?1")
    .bind(key)
    .first<PriceSnapshotRow>()
    .catch(() => null);

  if (!row) return null;
  const result = rowToResult(row);
  if (typeof staleAfterHours === "number" && !isFresh(result.retrievedAt, staleAfterHours)) {
    return null;
  }

  return result;
}

export async function writePriceSnapshot(search: PriceSnapshotSearch, result: WatchRefreshResult) {
  const db = await getD1Database();
  if (!db) return;

  const key = buildPriceSnapshotKey(search);
  const timestamp = nowIso();
  const rawJson = JSON.stringify({ search, result });

  await db
    .prepare(
      `INSERT INTO price_snapshots (
        snapshot_key, kind, provider, travel_mode, mode, destination_slug, destination_name,
        origin, destination_query, depart_date, return_date, adults, children,
        status, message, min_price, max_price, currency, sampled_dates,
        retrieved_at, source_url, source_detail, source_kind, raw_provider_json,
        created_at, updated_at
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7,
        ?8, ?9, ?10, ?11, ?12, ?13,
        ?14, ?15, ?16, ?17, 'USD', ?18,
        ?19, ?20, ?21, ?22, ?23,
        ?24, ?24
      )
      ON CONFLICT(snapshot_key) DO UPDATE SET
        provider = excluded.provider,
        travel_mode = excluded.travel_mode,
        mode = excluded.mode,
        destination_slug = excluded.destination_slug,
        destination_name = excluded.destination_name,
        origin = excluded.origin,
        destination_query = excluded.destination_query,
        depart_date = excluded.depart_date,
        return_date = excluded.return_date,
        adults = excluded.adults,
        children = excluded.children,
        status = excluded.status,
        message = excluded.message,
        min_price = excluded.min_price,
        max_price = excluded.max_price,
        sampled_dates = excluded.sampled_dates,
        retrieved_at = excluded.retrieved_at,
        source_url = excluded.source_url,
        source_detail = excluded.source_detail,
        source_kind = excluded.source_kind,
        raw_provider_json = excluded.raw_provider_json,
        updated_at = excluded.updated_at`
    )
    .bind(
      key,
      search.kind,
      result.provider ?? search.provider,
      search.travelMode ?? null,
      search.mode ?? null,
      search.destinationSlug,
      search.destinationName,
      search.origin ?? null,
      search.destinationQuery ?? null,
      search.departDate ?? null,
      search.returnDate ?? null,
      search.adults ?? null,
      search.children ?? null,
      result.status,
      result.message,
      result.currentRange?.min ?? null,
      result.currentRange?.max ?? null,
      result.sampledDates ?? null,
      result.retrievedAt ?? timestamp,
      result.sourceUrl ?? null,
      result.sourceDetail ?? null,
      result.sourceKind,
      rawJson,
      timestamp
    )
    .run()
    .catch(() => undefined);
}

export async function listRecentSavedSearches(limit = 20): Promise<SavedSearchSummary[]> {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare(
      `SELECT
        snapshot_key, kind, travel_mode, mode, destination_slug, destination_name, origin,
        depart_date, return_date, adults, updated_at
       FROM price_snapshots
       WHERE status = 'checked'
         AND depart_date IS NOT NULL
         AND return_date IS NOT NULL
       ORDER BY updated_at DESC
       LIMIT ?1`
    )
    .bind(Math.min(Math.max(Math.round(limit), 1), 50))
    .all<SavedSearchRow>()
    .catch(() => ({ results: [] }));

  return rows.results.map(rowToSavedSearch);
}
