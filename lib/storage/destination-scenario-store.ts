import { getD1Database, nowIso } from "@/lib/storage/cloudflare";
import type { TripPreferences } from "@/lib/types";

export type DestinationScenario = {
  destinationSlug: string;
  preferences: TripPreferences;
  updatedAt: string;
};

type DestinationScenarioRow = {
  destination_slug: string;
  payload_json: string;
  updated_at: string;
};

function parseScenario(row: DestinationScenarioRow): DestinationScenario | null {
  try {
    return {
      destinationSlug: row.destination_slug,
      preferences: JSON.parse(row.payload_json) as TripPreferences,
      updatedAt: row.updated_at
    };
  } catch {
    return null;
  }
}

export async function listDestinationScenarios(): Promise<DestinationScenario[]> {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare("SELECT destination_slug, payload_json, updated_at FROM destination_scenarios")
    .all<DestinationScenarioRow>()
    .catch(() => ({ results: [] }));

  return rows.results
    .map(parseScenario)
    .filter((scenario): scenario is DestinationScenario => Boolean(scenario));
}

export async function writeDestinationScenario(
  destinationSlug: string,
  preferences: TripPreferences
) {
  const db = await getD1Database();
  if (!db) return false;

  const timestamp = nowIso();
  const result = await db
    .prepare(
      `INSERT INTO destination_scenarios (
        destination_slug, payload_json, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?3)
      ON CONFLICT(destination_slug) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at`
    )
    .bind(destinationSlug, JSON.stringify(preferences), timestamp)
    .run()
    .catch(() => null);

  return Boolean(result);
}
