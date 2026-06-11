import { getD1Database, nowIso } from "@/lib/storage/cloudflare";
import { buildPriceSnapshotKey, type PriceSnapshotSearch } from "@/lib/storage/snapshot-keys";
import type { PriceSourceKind, WatchRefreshResult } from "@/lib/types";

type PriceSnapshotRow = {
  snapshot_key: string;
  kind: string;
  provider: string;
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
        ? `Cached ${row.kind} quote from durable storage.`
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
        snapshot_key, kind, provider, mode, destination_slug, destination_name,
        origin, destination_query, depart_date, return_date, adults, children,
        status, message, min_price, max_price, currency, sampled_dates,
        retrieved_at, source_url, source_detail, source_kind, raw_provider_json,
        created_at, updated_at
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6,
        ?7, ?8, ?9, ?10, ?11, ?12,
        ?13, ?14, ?15, ?16, 'USD', ?17,
        ?18, ?19, ?20, ?21, ?22,
        ?23, ?23
      )
      ON CONFLICT(snapshot_key) DO UPDATE SET
        provider = excluded.provider,
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
