import { destinations as seedDestinations } from "@/lib/seed-data";
import { defaultFallbackPhoto } from "@/lib/destination-photos";
import { withDiningFallback } from "@/lib/dining-estimates";
import { getD1Database, nowIso } from "@/lib/storage/cloudflare";
import type { Destination } from "@/lib/types";

type DestinationRow = {
  payload_json: string;
};

const seedBySlug = new Map(seedDestinations.map((destination) => [destination.slug, destination]));

function cleanMoodLabel(value?: string) {
  const normalized = value?.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized || normalized === "ai suggested" || normalized === "suggested idea") return undefined;
  return normalized.slice(0, 42);
}

function moodLabelFromDestination(destination: Destination) {
  const explicit = cleanMoodLabel(destination.visualTheme.moodLabel);
  if (explicit) return explicit;

  const highlights = destination.highlights
    .map((highlight) => highlight.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 2);
  if (highlights.length === 2) return `${highlights[0]} and ${highlights[1]}`.slice(0, 42);
  if (highlights.length === 1) return highlights[0].slice(0, 42);

  return (destination.tripType.split(/[,.]/)[0]?.trim().toLowerCase() || "slow travel").slice(0, 42);
}

function withFallbacks(destination: Destination): Destination {
  const seedPhoto = seedBySlug.get(destination.slug)?.visualTheme.photoUrl;
  const moodLabel = moodLabelFromDestination(destination);
  const existingPhoto = destination.visualTheme.photoUrl;
  const generatedPlaceholder =
    existingPhoto === defaultFallbackPhoto || existingPhoto.startsWith("/api/destinations/photo");
  const photoUrl = seedPhoto ?? (generatedPlaceholder ? "" : existingPhoto);

  return withDiningFallback({
    ...destination,
    visualTheme: {
      ...destination.visualTheme,
      photoUrl,
      moodLabel,
      photoPosition: destination.visualTheme.photoPosition ?? "center"
    }
  });
}

function parseDestination(row: DestinationRow): Destination | null {
  try {
    return withFallbacks(JSON.parse(row.payload_json) as Destination);
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
        ON CONFLICT(slug) DO UPDATE SET
          name = excluded.name,
          region = excluded.region,
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at`
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
  if (!db) return seedDestinations.map(withFallbacks);

  try {
    await ensureSeedDestinations(db);
    const rows = await db
      .prepare("SELECT payload_json FROM destination_candidates ORDER BY name")
      .all<DestinationRow>();
    const destinations = rows.results
      .map(parseDestination)
      .filter((destination): destination is Destination => Boolean(destination));

    return destinations.length ? destinations : seedDestinations.map(withFallbacks);
  } catch {
    return seedDestinations.map(withFallbacks);
  }
}

export async function writeDestinationCandidate(destination: Destination) {
  const db = await getD1Database();
  if (!db) return false;

  const timestamp = nowIso();
  const destinationWithPhoto = withFallbacks(destination);
  const result = await db
    .prepare(
      `INSERT INTO destination_candidates (
        slug, name, region, payload_json, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        region = excluded.region,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at`
    )
    .bind(
      destinationWithPhoto.slug,
      destinationWithPhoto.name,
      destinationWithPhoto.region,
      JSON.stringify(destinationWithPhoto),
      timestamp
    )
    .run()
    .catch(() => null);

  return Boolean(result);
}

export async function updateDestinationPhoto(slug: string, photoUrl: string) {
  const db = await getD1Database();
  if (!db) return false;

  const row = await db
    .prepare("SELECT payload_json FROM destination_candidates WHERE slug = ?1")
    .bind(slug)
    .first<DestinationRow>()
    .catch(() => null);

  if (!row) return false;

  try {
    const destination = JSON.parse(row.payload_json) as Destination;
    const nextDestination: Destination = {
      ...destination,
      visualTheme: {
        ...destination.visualTheme,
        photoUrl,
        photoSourceUrl: photoUrl,
        photoPosition: destination.visualTheme.photoPosition ?? "center"
      }
    };
    const timestamp = nowIso();
    const result = await db
      .prepare(
        `UPDATE destination_candidates
         SET payload_json = ?1, updated_at = ?2
         WHERE slug = ?3`
      )
      .bind(JSON.stringify(nextDestination), timestamp, slug)
      .run()
      .catch(() => null);

    return Boolean(result);
  } catch {
    return false;
  }
}
