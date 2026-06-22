import { getD1Database, nowIso } from "@/lib/storage/cloudflare";
import type { ArtShowLead, ArtShowLeadStatus, ArtWatchTerm } from "@/lib/types";

type ArtWatchTermRow = {
  id: string;
  label: string;
  active: number;
  created_at: string;
  updated_at: string;
};

type ArtShowLeadRow = {
  id: string;
  status: ArtShowLeadStatus;
  artist: string;
  title: string;
  venue: string;
  city: string;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  date_text: string;
  source_url: string;
  source_name: string;
  summary: string;
  travel_reason: string;
  score: number;
  raw_response_json: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

export type ArtShowWatchStorageState = {
  ready: boolean;
  message?: string;
};

export type ArtShowLeadInput = Omit<ArtShowLead, "createdAt" | "updatedAt" | "reviewedAt">;

const seedArtists = [
  "William-Adolphe Bouguereau",
  "John Singer Sargent",
  "Frederic Lord Leighton",
  "John William Waterhouse",
  "Anselm Kiefer",
  "Berthe Morisot",
  "Manet",
  "Tara Donovan",
  "Claudio Bravo",
  "Hans Memling",
  "Jean-Baptiste-Camille Corot",
  "Ruth Asawa",
  "Yayoi Kusama",
  "Ingres",
  "Mark Bradford",
  "Francis Alys",
  "James Turrell",
  "Raphael"
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function rowToWatchTerm(row: ArtWatchTermRow): ArtWatchTerm {
  return {
    id: row.id,
    label: row.label,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToLead(row: ArtShowLeadRow): ArtShowLead {
  return {
    id: row.id,
    status: row.status,
    artist: row.artist,
    title: row.title,
    venue: row.venue,
    city: row.city,
    country: row.country ?? undefined,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    dateText: row.date_text,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    summary: row.summary,
    travelReason: row.travel_reason,
    score: row.score,
    rawResponseJson: row.raw_response_json ?? undefined,
    model: row.model ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at ?? undefined
  };
}

export async function artShowWatchStorageState(): Promise<ArtShowWatchStorageState> {
  const db = await getD1Database();
  if (!db) {
    return {
      ready: false,
      message: "Art show watch storage is not available. Run with D1 to edit the shared list."
    };
  }

  const row = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'art_watch_terms'")
    .first<{ name: string }>()
    .catch(() => null);

  if (!row) {
    return {
      ready: false,
      message:
        "Art show watch storage is missing its tables. Run npm run d1:migrate:remote before searching shows."
    };
  }

  return { ready: true };
}

export async function listArtWatchTerms(): Promise<ArtWatchTerm[]> {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare(
      `SELECT * FROM art_watch_terms
       ORDER BY active DESC, label COLLATE NOCASE ASC`
    )
    .all<ArtWatchTermRow>()
    .catch(() => ({ results: [] }));

  return rows.results.map(rowToWatchTerm);
}

export async function ensureSeedArtWatchTerms() {
  const db = await getD1Database();
  if (!db) return false;

  const timestamp = nowIso();
  const result = await db
    .batch(
      seedArtists.map((label) =>
        db
          .prepare(
            `INSERT INTO art_watch_terms (id, label, active, created_at, updated_at)
             VALUES (?1, ?2, 1, ?3, ?3)
             ON CONFLICT(label) DO NOTHING`
          )
          .bind(slugify(label), label, timestamp)
      )
    )
    .catch(() => null);

  return Boolean(result);
}

export async function replaceArtWatchTerms(labels: string[]) {
  const db = await getD1Database();
  if (!db) return false;

  const timestamp = nowIso();
  const uniqueLabels = [...new Set(labels.map((label) => label.trim()).filter(Boolean))].slice(0, 80);
  const ids = uniqueLabels.map((label) => slugify(label));

  const statements = [
    db.prepare("UPDATE art_watch_terms SET active = 0, updated_at = ?1").bind(timestamp),
    ...uniqueLabels.map((label, index) =>
      db
        .prepare(
          `INSERT INTO art_watch_terms (id, label, active, created_at, updated_at)
           VALUES (?1, ?2, 1, ?3, ?3)
           ON CONFLICT(id) DO UPDATE SET
             label = excluded.label,
             active = 1,
             updated_at = excluded.updated_at`
        )
        .bind(ids[index], label, timestamp)
    )
  ];

  const result = await db.batch(statements).catch(() => null);
  return Boolean(result);
}

export async function listArtShowLeads(
  status: ArtShowLeadStatus = "new"
): Promise<ArtShowLead[]> {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare(
      `SELECT * FROM art_show_leads
       WHERE status = ?1
       ORDER BY score DESC, updated_at DESC
       LIMIT 30`
    )
    .bind(status)
    .all<ArtShowLeadRow>()
    .catch(() => ({ results: [] }));

  return rows.results.map(rowToLead);
}

export async function writeArtShowLeads(leads: ArtShowLeadInput[]) {
  const db = await getD1Database();
  if (!db || !leads.length) return false;

  const timestamp = nowIso();
  const result = await db
    .batch(
      leads.map((lead) =>
        db
          .prepare(
            `INSERT INTO art_show_leads (
              id, status, artist, title, venue, city, country, start_date,
              end_date, date_text, source_url, source_name, summary, travel_reason,
              score, raw_response_json, model, created_at, updated_at, reviewed_at
            ) VALUES (
              ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
              ?9, ?10, ?11, ?12, ?13, ?14,
              ?15, ?16, ?17, ?18, ?18, NULL
            )
            ON CONFLICT(source_url, artist, title) DO UPDATE SET
              status = CASE
                WHEN art_show_leads.status = 'hidden' THEN art_show_leads.status
                ELSE excluded.status
              END,
              venue = excluded.venue,
              city = excluded.city,
              country = excluded.country,
              start_date = excluded.start_date,
              end_date = excluded.end_date,
              date_text = excluded.date_text,
              source_name = excluded.source_name,
              summary = excluded.summary,
              travel_reason = excluded.travel_reason,
              score = excluded.score,
              raw_response_json = excluded.raw_response_json,
              model = excluded.model,
              updated_at = excluded.updated_at`
          )
          .bind(
            lead.id,
            lead.status,
            lead.artist,
            lead.title,
            lead.venue,
            lead.city,
            lead.country ?? null,
            lead.startDate ?? null,
            lead.endDate ?? null,
            lead.dateText,
            lead.sourceUrl,
            lead.sourceName,
            lead.summary,
            lead.travelReason,
            lead.score,
            lead.rawResponseJson ?? null,
            lead.model ?? null,
            timestamp
          )
      )
    )
    .catch(() => null);

  return Boolean(result);
}

export async function updateArtShowLeadStatus(id: string, status: ArtShowLeadStatus) {
  const db = await getD1Database();
  if (!db) return false;

  const timestamp = nowIso();
  const result = await db
    .prepare(
      `UPDATE art_show_leads
       SET status = ?1, updated_at = ?2, reviewed_at = ?2
       WHERE id = ?3`
    )
    .bind(status, timestamp, id)
    .run()
    .catch(() => null);

  return Boolean(result);
}
