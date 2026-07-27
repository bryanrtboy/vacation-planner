import { getD1Database, nowIso } from "@/lib/storage/cloudflare";
import type {
  StudioSpaceLead,
  StudioSpaceLeadKind,
  StudioSpaceLeadStatus
} from "@/lib/types";

type StudioSpaceLeadRow = {
  id: string;
  status: StudioSpaceLeadStatus;
  kind: StudioSpaceLeadKind;
  title: string;
  city: string;
  country: string | null;
  source_url: string;
  source_name: string;
  posted_date: string | null;
  availability_text: string | null;
  price_text: string | null;
  duration_text: string | null;
  accommodation_note: string | null;
  workspace_note: string | null;
  contact_text: string | null;
  medium_tags: string | null;
  summary: string;
  score: number;
  was_saved: number;
  last_seen_at: string;
  raw_response_json: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

export type StudioSpaceLeadInput = Omit<StudioSpaceLead, "createdAt" | "updatedAt" | "reviewedAt">;

export type StudioSpaceStorageState = {
  ready: boolean;
  message?: string;
};

function rowToStudioSpaceLead(row: StudioSpaceLeadRow): StudioSpaceLead {
  return {
    id: row.id,
    status: row.status,
    kind: row.kind,
    title: row.title,
    city: row.city,
    country: row.country ?? undefined,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    postedDate: row.posted_date ?? undefined,
    availabilityText: row.availability_text ?? undefined,
    priceText: row.price_text ?? undefined,
    durationText: row.duration_text ?? undefined,
    accommodationNote: row.accommodation_note ?? undefined,
    workspaceNote: row.workspace_note ?? undefined,
    contactText: row.contact_text ?? undefined,
    mediumTags: row.medium_tags ? row.medium_tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
    summary: row.summary,
    score: row.score,
    wasSaved: Boolean(row.was_saved),
    lastSeenAt: row.last_seen_at,
    rawResponseJson: row.raw_response_json ?? undefined,
    model: row.model ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at ?? undefined
  };
}

export async function studioSpaceStorageState(): Promise<StudioSpaceStorageState> {
  const db = await getD1Database();
  if (!db) {
    return {
      ready: false,
      message: "Studio space storage is not available. Run with D1 to save and review studio leads."
    };
  }

  const row = await db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name = 'studio_space_leads'`
    )
    .first<{ name: string }>()
    .catch(() => null);

  if (!row) {
    return {
      ready: false,
      message:
        "Studio space storage is missing its table. Run npm run d1:migrate:remote before refreshing studio leads."
    };
  }

  return { ready: true };
}

export async function listStudioSpaceLeads(status?: StudioSpaceLeadStatus): Promise<StudioSpaceLead[]> {
  const db = await getD1Database();
  if (!db) return [];

  const query = status
    ? `SELECT * FROM studio_space_leads
       WHERE status = ?1
       ORDER BY score DESC, posted_date DESC, updated_at DESC
       LIMIT 80`
    : `SELECT * FROM studio_space_leads
       WHERE status <> 'hidden'
       ORDER BY score DESC, posted_date DESC, updated_at DESC
       LIMIT 120`;
  const statement = db.prepare(query);
  const rows = status
    ? await statement.bind(status).all<StudioSpaceLeadRow>().catch(() => ({ results: [] }))
    : await statement.all<StudioSpaceLeadRow>().catch(() => ({ results: [] }));

  return rows.results.map(rowToStudioSpaceLead);
}

export async function writeStudioSpaceLeads(leads: StudioSpaceLeadInput[]) {
  const db = await getD1Database();
  if (!db) return false;
  if (!leads.length) return true;

  const timestamp = nowIso();
  const result = await db
    .batch(
      leads.map((lead) =>
        db
          .prepare(
            `INSERT INTO studio_space_leads (
              id, status, kind, title, city, country, source_url, source_name,
              posted_date, availability_text, price_text, duration_text,
              accommodation_note, workspace_note, contact_text, medium_tags,
              summary, score, was_saved, last_seen_at, raw_response_json, model,
              created_at, updated_at
            )
            VALUES (
              ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
              ?9, ?10, ?11, ?12,
              ?13, ?14, ?15, ?16,
              ?17, ?18, ?19, ?20, ?21, ?22,
              ?23, ?23
            )
            ON CONFLICT(source_url, title, posted_date) DO UPDATE SET
              kind = excluded.kind,
              city = excluded.city,
              country = excluded.country,
              source_name = excluded.source_name,
              availability_text = excluded.availability_text,
              price_text = excluded.price_text,
              duration_text = excluded.duration_text,
              accommodation_note = excluded.accommodation_note,
              workspace_note = excluded.workspace_note,
              contact_text = excluded.contact_text,
              medium_tags = excluded.medium_tags,
              summary = excluded.summary,
              score = excluded.score,
              last_seen_at = excluded.last_seen_at,
              raw_response_json = excluded.raw_response_json,
              model = excluded.model,
              status = CASE
                WHEN studio_space_leads.status IN ('saved', 'hidden') THEN studio_space_leads.status
                ELSE excluded.status
              END,
              was_saved = CASE
                WHEN studio_space_leads.was_saved = 1 THEN 1
                ELSE excluded.was_saved
              END,
              updated_at = excluded.updated_at`
          )
          .bind(
            lead.id,
            lead.status,
            lead.kind,
            lead.title,
            lead.city,
            lead.country ?? null,
            lead.sourceUrl,
            lead.sourceName,
            lead.postedDate ?? null,
            lead.availabilityText ?? null,
            lead.priceText ?? null,
            lead.durationText ?? null,
            lead.accommodationNote ?? null,
            lead.workspaceNote ?? null,
            lead.contactText ?? null,
            lead.mediumTags.join(","),
            lead.summary,
            lead.score,
            lead.wasSaved ? 1 : 0,
            lead.lastSeenAt,
            lead.rawResponseJson ?? null,
            lead.model ?? null,
            timestamp
          )
      )
    )
    .catch(() => null);

  return Boolean(result);
}

export async function updateStudioSpaceLeadStatus(id: string, status: StudioSpaceLeadStatus) {
  const db = await getD1Database();
  if (!db) return false;

  const timestamp = nowIso();
  const result = await db
    .prepare(
      `UPDATE studio_space_leads
       SET status = ?1,
           was_saved = CASE WHEN ?1 = 'saved' THEN 1 ELSE was_saved END,
           reviewed_at = ?2,
           updated_at = ?2
       WHERE id = ?3`
    )
    .bind(status, timestamp, id)
    .run()
    .catch(() => null);

  return Boolean(result);
}
