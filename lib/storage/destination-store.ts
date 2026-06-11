import { destinations as seedDestinations } from "@/lib/seed-data";
import { getD1Database, nowIso } from "@/lib/storage/cloudflare";
import type { Destination } from "@/lib/types";

type DestinationRow = {
  payload_json: string;
};

const seedBySlug = new Map(seedDestinations.map((destination) => [destination.slug, destination]));

const fallbackPhotoByRegion: Record<string, string> = {
  Austria: "https://commons.wikimedia.org/wiki/Special:FilePath/Graz-hauptplatz-2007.jpg?width=800",
  Canada:
    "https://commons.wikimedia.org/wiki/Special:FilePath/British%20Columbia%20Parliament%20Buildings%20-%20Pano%20-%20HDR.jpg?width=800",
  Italy:
    "https://commons.wikimedia.org/wiki/Special:FilePath/Panoramica%20Cattedrale%20di%20Palermo.jpg?width=800",
  Mexico: "https://commons.wikimedia.org/wiki/Special:FilePath/Colonial%20Oaxaca.jpg?width=800",
  Morocco:
    "https://commons.wikimedia.org/wiki/Special:FilePath/Morocco%20-%20Essaouira%20Part%202%20%2831679848385%29.jpg?width=800",
  Portugal:
    "https://commons.wikimedia.org/wiki/Special:FilePath/Puente%20Don%20Luis%20I%2C%20Oporto%2C%20Portugal%2C%202012-05-09%2C%20DD%2013.JPG?width=800",
  Slovenia:
    "https://commons.wikimedia.org/wiki/Special:FilePath/Ljubljana%20Old%20Town%2C%20Slovenia%20%28Old%20Camera%29%20%2833286165680%29.jpg?width=800",
  Spain:
    "https://commons.wikimedia.org/wiki/Special:FilePath/Ciutat%20de%20les%20Arts%20i%20les%20Ci%C3%A8ncies%20at%20night%2C%20May%202017.jpg?width=800",
  "United States":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Palace%20of%20the%20Governors.jpg?width=800"
};

const defaultFallbackPhoto =
  "https://commons.wikimedia.org/wiki/Special:FilePath/Puente%20Don%20Luis%20I%2C%20Oporto%2C%20Portugal%2C%202012-05-09%2C%20DD%2013.JPG?width=800";

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

function withPhotoFallback(destination: Destination): Destination {
  const seedPhoto = seedBySlug.get(destination.slug)?.visualTheme.photoUrl;
  const fallbackPhoto = seedPhoto ?? fallbackPhotoByRegion[destination.region] ?? defaultFallbackPhoto;

  return {
    ...destination,
    visualTheme: {
      ...destination.visualTheme,
      photoUrl: destination.visualTheme.photoUrl || fallbackPhoto,
      moodLabel: moodLabelFromDestination(destination),
      photoPosition: destination.visualTheme.photoPosition ?? "center"
    }
  };
}

function parseDestination(row: DestinationRow): Destination | null {
  try {
    return withPhotoFallback(JSON.parse(row.payload_json) as Destination);
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
  if (!db) return seedDestinations.map(withPhotoFallback);

  try {
    await ensureSeedDestinations(db);
    const rows = await db
      .prepare("SELECT payload_json FROM destination_candidates ORDER BY name")
      .all<DestinationRow>();
    const destinations = rows.results
      .map(parseDestination)
      .filter((destination): destination is Destination => Boolean(destination));

    return destinations.length ? destinations : seedDestinations.map(withPhotoFallback);
  } catch {
    return seedDestinations.map(withPhotoFallback);
  }
}

export async function writeDestinationCandidate(destination: Destination) {
  const db = await getD1Database();
  if (!db) return false;

  const timestamp = nowIso();
  const destinationWithPhoto = withPhotoFallback(destination);
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
