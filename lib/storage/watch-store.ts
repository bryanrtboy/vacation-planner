import { getD1Database, nowIso } from "@/lib/storage/cloudflare";
import type { WatchedSearch } from "@/lib/types";

type WatchRow = {
  payload_json: string;
};

function parseWatch(row: WatchRow): WatchedSearch | null {
  try {
    return JSON.parse(row.payload_json) as WatchedSearch;
  } catch {
    return null;
  }
}

export async function listStoredWatches(): Promise<WatchedSearch[] | null> {
  const db = await getD1Database();
  if (!db) return null;

  const result = await db
    .prepare("SELECT payload_json FROM watches ORDER BY updated_at DESC")
    .all<WatchRow>()
    .catch(() => null);

  if (!result) return null;
  return result.results.map(parseWatch).filter((watch): watch is WatchedSearch => Boolean(watch));
}

export async function replaceStoredWatches(watches: WatchedSearch[]) {
  const db = await getD1Database();
  if (!db) return false;

  const timestamp = nowIso();

  try {
    await db.prepare("DELETE FROM watches").run();
    for (const watch of watches) {
      await db
        .prepare(
          `INSERT INTO watches (
            id, destination_slug, destination_name, payload_json, created_at, updated_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?5)`
        )
        .bind(
          watch.id,
          watch.destinationSlug,
          watch.destinationName,
          JSON.stringify(watch),
          timestamp
        )
        .run();
    }
    return true;
  } catch {
    return false;
  }
}
