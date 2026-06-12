import { getD1Database, nowIso } from "@/lib/storage/cloudflare";
import { defaultTripPreferences } from "@/lib/trip-preferences";
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

type PriceSnapshotScenarioRow = {
  kind: "airfare" | "lodging";
  travel_mode: "fly" | "drive" | null;
  mode: string | null;
  destination_slug: string;
  origin: string | null;
  depart_date: string | null;
  return_date: string | null;
  adults: number | null;
  updated_at: string;
};

function nightsBetween(departDate: string | null, returnDate: string | null) {
  if (!departDate || !returnDate) return defaultTripPreferences.nights;
  const start = new Date(`${departDate}T00:00:00Z`).getTime();
  const end = new Date(`${returnDate}T00:00:00Z`).getTime();
  const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Number.isFinite(nights) && nights > 0 ? nights : defaultTripPreferences.nights;
}

function lodgingPreference(mode: string | null) {
  if (mode === "hotel") return "hotels";
  if (mode === "group-house") return "group house rentals";
  if (mode === "apartment") return "apartments for 2";
  return defaultTripPreferences.lodging;
}

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

function scenarioFromSnapshot(row: PriceSnapshotScenarioRow): DestinationScenario {
  const travelMode =
    row.travel_mode === "drive" ? "drive" : row.travel_mode === "fly" ? "fly" : "fly";

  return {
    destinationSlug: row.destination_slug,
    preferences: {
      ...defaultTripPreferences,
      departure: row.origin ?? defaultTripPreferences.departure,
      travelMode,
      flightCount: row.adults ?? defaultTripPreferences.flightCount,
      nights: nightsBetween(row.depart_date, row.return_date),
      lodging: row.kind === "lodging" ? lodgingPreference(row.mode) : defaultTripPreferences.lodging,
      departDate: row.depart_date ?? undefined,
      returnDate: row.return_date ?? undefined,
      travelSeason: row.depart_date && row.return_date ? "saved" : defaultTripPreferences.travelSeason
    },
    updatedAt: row.updated_at
  };
}

function newerScenario(current: DestinationScenario | undefined, candidate: DestinationScenario) {
  if (!current) return candidate;
  return new Date(candidate.updatedAt).getTime() > new Date(current.updatedAt).getTime()
    ? candidate
    : current;
}

export async function listDestinationScenarios(): Promise<DestinationScenario[]> {
  const db = await getD1Database();
  if (!db) return [];

  const snapshotRows = await db
    .prepare(
      `SELECT
        kind, travel_mode, mode, destination_slug, origin, depart_date,
        return_date, adults, updated_at
       FROM price_snapshots
       WHERE status = 'checked'
         AND depart_date IS NOT NULL
         AND return_date IS NOT NULL
       ORDER BY updated_at DESC
       LIMIT 200`
    )
    .all<PriceSnapshotScenarioRow>()
    .catch(() => ({ results: [] }));
  const scenarioBySlug = new Map<string, DestinationScenario>();
  for (const row of snapshotRows.results) {
    const scenario = scenarioFromSnapshot(row);
    scenarioBySlug.set(
      row.destination_slug,
      newerScenario(scenarioBySlug.get(row.destination_slug), scenario)
    );
  }

  const scenarioRows = await db
    .prepare("SELECT destination_slug, payload_json, updated_at FROM destination_scenarios")
    .all<DestinationScenarioRow>()
    .catch(() => ({ results: [] }));

  for (const scenario of scenarioRows.results
    .map(parseScenario)
    .filter((scenario): scenario is DestinationScenario => Boolean(scenario))) {
    scenarioBySlug.set(
      scenario.destinationSlug,
      newerScenario(scenarioBySlug.get(scenario.destinationSlug), scenario)
    );
  }

  return [...scenarioBySlug.values()];
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
