import { destinations as seedDestinations } from "@/lib/seed-data";
import { getD1Database, nowIso } from "@/lib/storage/cloudflare";
import type { Destination } from "@/lib/types";

type DestinationRow = {
  payload_json: string;
};

function parseDestination(row: DestinationRow): Destination | null {
  try {
    return JSON.parse(row.payload_json) as Destination;
  } catch {
    return null;
  }
}

async function ensureSeedDestinations(db: D1Database) {
  const timestamp = nowIso();

  for (const destination of seedDestinations) {
    await db
      .prepare(
        `INSERT INTO destination_candidates (
          slug, name, region, payload_json, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
        ON CONFLICT(slug) DO NOTHING`
      )
      .bind(
        destination.slug,
        destination.name,
        destination.region,
        JSON.stringify(destination),
        timestamp
      )
      .run();
  }
}

export async function listDestinationCandidates(): Promise<Destination[]> {
  const db = await getD1Database();
  if (!db) return seedDestinations;

  try {
    await ensureSeedDestinations(db);
    const rows = await db
      .prepare("SELECT payload_json FROM destination_candidates ORDER BY name")
      .all<DestinationRow>();
    const destinations = rows.results
      .map(parseDestination)
      .filter((destination): destination is Destination => Boolean(destination));

    return destinations.length ? destinations : seedDestinations;
  } catch {
    return seedDestinations;
  }
}
