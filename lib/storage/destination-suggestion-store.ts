import { getD1Database, nowIso } from "@/lib/storage/cloudflare";
import type {
  DestinationSuggestion,
  DestinationSuggestionPromptKind,
  DestinationSuggestionStatus
} from "@/lib/types";

type DestinationSuggestionRow = {
  id: string;
  request_key: string;
  status: DestinationSuggestionStatus;
  source: DestinationSuggestion["source"];
  prompt_kind: DestinationSuggestionPromptKind;
  parent_slug: string | null;
  region: string | null;
  name: string;
  destination_slug: string | null;
  payload_json: string;
  raw_response_json: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

export type DestinationSuggestionInput = Omit<
  DestinationSuggestion,
  "createdAt" | "updatedAt" | "reviewedAt"
> & {
  reviewedAt?: string;
};

export type DestinationSuggestionStorageState = {
  ready: boolean;
  message?: string;
};

function rowToSuggestion(row: DestinationSuggestionRow): DestinationSuggestion | null {
  try {
    return {
      id: row.id,
      requestKey: row.request_key,
      status: row.status,
      source: row.source,
      promptKind: row.prompt_kind,
      parentSlug: row.parent_slug ?? undefined,
      region: row.region ?? undefined,
      name: row.name,
      destinationSlug: row.destination_slug ?? undefined,
      payload: JSON.parse(row.payload_json) as DestinationSuggestion["payload"],
      rawResponseJson: row.raw_response_json ?? undefined,
      model: row.model ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      reviewedAt: row.reviewed_at ?? undefined
    };
  } catch {
    return null;
  }
}

export async function listDestinationSuggestions(
  status: DestinationSuggestionStatus = "draft"
): Promise<DestinationSuggestion[]> {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare(
      `SELECT * FROM destination_suggestions
       WHERE status = ?1
       ORDER BY updated_at DESC`
    )
    .bind(status)
    .all<DestinationSuggestionRow>()
    .catch(() => ({ results: [] }));

  return rows.results
    .map(rowToSuggestion)
    .filter((suggestion): suggestion is DestinationSuggestion => Boolean(suggestion));
}

export async function destinationSuggestionStorageState(): Promise<DestinationSuggestionStorageState> {
  const db = await getD1Database();
  if (!db) {
    return {
      ready: false,
      message: "D1 is not available, so destination suggestions cannot be saved."
    };
  }

  const row = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'destination_suggestions'")
    .first<{ name: string }>()
    .catch(() => null);

  if (!row) {
    return {
      ready: false,
      message:
        "The destination_suggestions table is missing. Run npm run d1:migrate:remote before using Gemini suggestions."
    };
  }

  return { ready: true };
}

export async function getDestinationSuggestion(id: string): Promise<DestinationSuggestion | null> {
  const db = await getD1Database();
  if (!db) return null;

  const row = await db
    .prepare("SELECT * FROM destination_suggestions WHERE id = ?1")
    .bind(id)
    .first<DestinationSuggestionRow>()
    .catch(() => null);

  return row ? rowToSuggestion(row) : null;
}

export async function writeDestinationSuggestions(suggestions: DestinationSuggestionInput[]) {
  const db = await getD1Database();
  if (!db || !suggestions.length) return false;

  const timestamp = nowIso();

  const result = await db
    .batch(
      suggestions.map((suggestion) =>
        db
          .prepare(
            `INSERT INTO destination_suggestions (
              id, request_key, status, source, prompt_kind, parent_slug, region,
              name, destination_slug, payload_json, raw_response_json, model,
              created_at, updated_at, reviewed_at
            ) VALUES (
              ?1, ?2, ?3, ?4, ?5, ?6, ?7,
              ?8, ?9, ?10, ?11, ?12,
              ?13, ?13, ?14
            )
            ON CONFLICT(id) DO UPDATE SET
              request_key = excluded.request_key,
              status = excluded.status,
              source = excluded.source,
              prompt_kind = excluded.prompt_kind,
              parent_slug = excluded.parent_slug,
              region = excluded.region,
              name = excluded.name,
              destination_slug = excluded.destination_slug,
              payload_json = excluded.payload_json,
              raw_response_json = excluded.raw_response_json,
              model = excluded.model,
              updated_at = excluded.updated_at,
              reviewed_at = excluded.reviewed_at`
          )
          .bind(
            suggestion.id,
            suggestion.requestKey,
            suggestion.status,
            suggestion.source,
            suggestion.promptKind,
            suggestion.parentSlug ?? null,
            suggestion.region ?? null,
            suggestion.name,
            suggestion.destinationSlug ?? null,
            JSON.stringify(suggestion.payload),
            suggestion.rawResponseJson ?? null,
            suggestion.model ?? null,
            timestamp,
            suggestion.reviewedAt ?? null
          )
      )
    )
    .catch(() => null);

  return Boolean(result);
}

export async function updateDestinationSuggestionStatus(
  id: string,
  status: DestinationSuggestionStatus
) {
  const db = await getD1Database();
  if (!db) return false;

  const timestamp = nowIso();

  const result = await db
    .prepare(
      `UPDATE destination_suggestions
       SET status = ?1, updated_at = ?2, reviewed_at = ?2
       WHERE id = ?3`
    )
    .bind(status, timestamp, id)
    .run()
    .catch(() => null);

  return Boolean(result);
}
