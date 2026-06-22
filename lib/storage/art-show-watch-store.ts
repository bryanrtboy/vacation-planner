import { getD1Database, nowIso } from "@/lib/storage/cloudflare";
import type {
  ArtShowLead,
  ArtShowLeadStatus,
  ArtShowSearchBatch,
  ArtShowSearchBatchStatus,
  ArtShowSearchProgress,
  ArtShowSearchRun,
  ArtShowSearchRunStatus,
  ArtWatchTerm
} from "@/lib/types";

type ArtWatchTermRow = {
  id: string;
  label: string;
  active: number;
  last_searched_at: string | null;
  last_failed_at: string | null;
  search_failure_count: number | null;
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

type ArtShowSearchRunRow = {
  id: string;
  status: ArtShowSearchRunStatus;
  artist_count: number;
  result_count: number;
  message: string | null;
  started_at: string;
  completed_at: string | null;
};

type ArtShowSearchBatchRow = {
  id: string;
  run_id: string;
  status: ArtShowSearchBatchStatus;
  term_labels_json: string;
  result_count: number;
  message: string | null;
  attempt_count: number;
  started_at: string | null;
  completed_at: string | null;
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

export const artShowBatchSize = 6;

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
    lastSearchedAt: row.last_searched_at ?? undefined,
    lastFailedAt: row.last_failed_at ?? undefined,
    searchFailureCount: row.search_failure_count ?? 0,
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

function rowToSearchRun(row: ArtShowSearchRunRow): ArtShowSearchRun {
  return {
    id: row.id,
    status: row.status,
    artistCount: row.artist_count,
    resultCount: row.result_count,
    message: row.message ?? undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined
  };
}

function rowToSearchBatch(row: ArtShowSearchBatchRow): ArtShowSearchBatch {
  let termLabels: string[] = [];

  try {
    const parsed = JSON.parse(row.term_labels_json) as unknown;
    termLabels = Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    termLabels = [];
  }

  return {
    id: row.id,
    runId: row.run_id,
    status: row.status,
    termLabels,
    resultCount: row.result_count,
    message: row.message ?? undefined,
    attemptCount: row.attempt_count,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined
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

  const rows = await db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name IN (
           'art_watch_terms',
           'art_show_leads',
           'art_show_search_runs',
           'art_show_search_batches'
         )`
    )
    .all<{ name: string }>()
    .catch(() => null);

  const tableNames = new Set(rows?.results.map((row) => row.name) ?? []);
  if (
    !tableNames.has("art_watch_terms") ||
    !tableNames.has("art_show_leads") ||
    !tableNames.has("art_show_search_runs") ||
    !tableNames.has("art_show_search_batches")
  ) {
    return {
      ready: false,
      message:
        "Art show watch storage is missing its tables. Run npm run d1:migrate:remote before searching shows."
    };
  }

  const termColumns = await db
    .prepare("PRAGMA table_info(art_watch_terms)")
    .all<{ name: string }>()
    .catch(() => null);
  const termColumnNames = new Set(termColumns?.results.map((row) => row.name) ?? []);
  if (!termColumnNames.has("last_failed_at") || !termColumnNames.has("search_failure_count")) {
    return {
      ready: false,
      message:
        "Art show watch storage is missing failure cooldown columns. Run npm run d1:migrate:remote before searching shows."
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

export async function listArtWatchTermsWithSeed(): Promise<ArtWatchTerm[]> {
  let terms = await listArtWatchTerms();
  if (!terms.length) {
    await ensureSeedArtWatchTerms();
    terms = await listArtWatchTerms();
  }
  return terms;
}

export function sortedArtWatchTermsForSearch(terms: ArtWatchTerm[]) {
  return [...terms]
    .filter((term) => term.active)
    .sort((first, second) => {
      if (!first.lastSearchedAt && second.lastSearchedAt) return -1;
      if (first.lastSearchedAt && !second.lastSearchedAt) return 1;
      if (first.lastSearchedAt && second.lastSearchedAt) {
        const dateDelta =
          new Date(first.lastSearchedAt).getTime() - new Date(second.lastSearchedAt).getTime();
        if (dateDelta) return dateDelta;
      }
      return first.label.localeCompare(second.label);
    });
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

function canonicalArtShowSourceUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

async function hiddenArtShowSourceUrlKeys() {
  const db = await getD1Database();
  if (!db) return new Set<string>();

  const rows = await db
    .prepare("SELECT source_url FROM art_show_leads WHERE status = 'hidden'")
    .all<{ source_url: string }>()
    .catch(() => ({ results: [] }));

  return new Set(rows.results.map((row) => canonicalArtShowSourceUrl(row.source_url)));
}

export async function writeArtShowLeads(leads: ArtShowLeadInput[]) {
  const db = await getD1Database();
  if (!db || !leads.length) return false;

  const hiddenSourceUrls = await hiddenArtShowSourceUrlKeys();
  const visibleLeads = leads.filter(
    (lead) => !hiddenSourceUrls.has(canonicalArtShowSourceUrl(lead.sourceUrl))
  );
  if (!visibleLeads.length) return true;

  const timestamp = nowIso();
  const result = await db
    .batch(
      visibleLeads.map((lead) =>
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

export async function markActiveArtWatchTermsSearched(timestamp = nowIso()) {
  const db = await getD1Database();
  if (!db) return false;

  const result = await db
    .prepare(
      `UPDATE art_watch_terms
       SET last_searched_at = ?1,
           last_failed_at = NULL,
           search_failure_count = 0,
           updated_at = ?1
       WHERE active = 1`
    )
    .bind(timestamp)
    .run()
    .catch(() => null);

  return Boolean(result);
}

export async function markArtWatchTermsSearched(labels: string[], timestamp = nowIso()) {
  const db = await getD1Database();
  if (!db || !labels.length) return false;

  const ids = labels.map((label) => slugify(label));
  const placeholders = ids.map((_, index) => `?${index + 2}`).join(", ");
  const result = await db
    .prepare(
      `UPDATE art_watch_terms
       SET last_searched_at = ?1,
           last_failed_at = NULL,
           search_failure_count = 0,
           updated_at = ?1
       WHERE id IN (${placeholders})`
    )
    .bind(timestamp, ...ids)
    .run()
    .catch(() => null);

  return Boolean(result);
}

export async function markArtWatchTermsSearchFailed(labels: string[], timestamp = nowIso()) {
  const db = await getD1Database();
  if (!db || !labels.length) return false;

  const ids = labels.map((label) => slugify(label));
  const placeholders = ids.map((_, index) => `?${index + 2}`).join(", ");
  const result = await db
    .prepare(
      `UPDATE art_watch_terms
       SET last_failed_at = ?1,
           search_failure_count = COALESCE(search_failure_count, 0) + 1,
           updated_at = ?1
       WHERE id IN (${placeholders})`
    )
    .bind(timestamp, ...ids)
    .run()
    .catch(() => null);

  return Boolean(result);
}

export async function createArtShowSearchRun(
  terms: ArtWatchTerm[],
  batchSize = artShowBatchSize
): Promise<ArtShowSearchRun | null> {
  const db = await getD1Database();
  if (!db) return null;

  const timestamp = nowIso();
  const id = `art-show-${Date.now().toString(36)}`;
  const activeTerms = sortedArtWatchTermsForSearch(terms);
  const batches: string[][] = [];

  for (let index = 0; index < activeTerms.length; index += batchSize) {
    batches.push(activeTerms.slice(index, index + batchSize).map((term) => term.label));
  }

  const result = await db
    .batch([
      db
        .prepare(
          `INSERT INTO art_show_search_runs (
            id, status, artist_count, result_count, message, started_at, completed_at
          ) VALUES (?1, 'running', ?2, 0, ?3, ?4, NULL)`
        )
        .bind(
          id,
          activeTerms.length,
          `Queued ${batches.length} art show search batch${batches.length === 1 ? "" : "es"}.`,
          timestamp
        ),
      ...batches.map((batch, index) =>
        db
          .prepare(
            `INSERT INTO art_show_search_batches (
              id, run_id, status, term_labels_json, result_count, message,
              attempt_count, started_at, completed_at
            ) VALUES (?1, ?2, 'pending', ?3, 0, NULL, 0, NULL, NULL)`
          )
          .bind(`${id}-batch-${String(index + 1).padStart(3, "0")}`, id, JSON.stringify(batch))
      )
    ])
    .catch(() => null);

  if (!result) return null;

  return {
    id,
    status: "running",
    artistCount: activeTerms.length,
    resultCount: 0,
    message: `Queued ${batches.length} art show search batch${batches.length === 1 ? "" : "es"}.`,
    startedAt: timestamp
  };
}

export async function getActiveArtShowSearchRun(): Promise<ArtShowSearchRun | null> {
  const db = await getD1Database();
  if (!db) return null;

  const row = await db
    .prepare(
      `SELECT * FROM art_show_search_runs
       WHERE status = 'running'
       ORDER BY started_at DESC
       LIMIT 1`
    )
    .first<ArtShowSearchRunRow>()
    .catch(() => null);

  return row ? rowToSearchRun(row) : null;
}

export async function expireStaleArtShowSearchRuns(cutoffIso: string) {
  const db = await getD1Database();
  if (!db) return false;

  const result = await db
    .prepare(
      `UPDATE art_show_search_runs
       SET status = 'error',
           result_count = 0,
           message = 'Art show search timed out before Cloudflare could finish it. Try again with a smaller watchlist or retry later.',
           completed_at = ?1
       WHERE status = 'running'
         AND started_at < ?2`
    )
    .bind(nowIso(), cutoffIso)
    .run()
    .catch(() => null);

  return Boolean(result);
}

export async function expireStaleArtShowSearchRunsWithoutBatches(cutoffIso: string) {
  const db = await getD1Database();
  if (!db) return false;

  const result = await db
    .prepare(
      `UPDATE art_show_search_runs
       SET status = 'error',
           result_count = 0,
           message = 'Art show search timed out before batch tracking was available. Start a new sweep to continue.',
           completed_at = ?1
       WHERE status = 'running'
         AND started_at < ?2
         AND NOT EXISTS (
           SELECT 1 FROM art_show_search_batches
           WHERE art_show_search_batches.run_id = art_show_search_runs.id
         )`
    )
    .bind(nowIso(), cutoffIso)
    .run()
    .catch(() => null);

  return Boolean(result);
}

export async function expireStaleArtShowSearchBatches(cutoffIso: string) {
  const db = await getD1Database();
  if (!db) return false;

  const staleRows = await db
    .prepare(
      `SELECT * FROM art_show_search_batches
       WHERE status = 'running'
         AND started_at < ?1`
    )
    .bind(cutoffIso)
    .all<ArtShowSearchBatchRow>()
    .catch(() => ({ results: [] }));
  const staleLabels = staleRows.results.flatMap((row) => rowToSearchBatch(row).termLabels);

  const timestamp = nowIso();
  const result = await db
    .prepare(
      `UPDATE art_show_search_batches
       SET status = 'error',
           message = 'Batch timed out. Retry will continue with remaining names.',
           completed_at = ?1
       WHERE status = 'running'
         AND started_at < ?2`
    )
    .bind(timestamp, cutoffIso)
    .run()
    .catch(() => null);

  if (result && staleLabels.length) await markArtWatchTermsSearchFailed(staleLabels, timestamp);

  return Boolean(result);
}

export async function getLatestArtShowSearchRun(): Promise<ArtShowSearchRun | null> {
  const db = await getD1Database();
  if (!db) return null;

  const row = await db
    .prepare(
      `SELECT * FROM art_show_search_runs
       ORDER BY started_at DESC
       LIMIT 1`
    )
    .first<ArtShowSearchRunRow>()
    .catch(() => null);

  return row ? rowToSearchRun(row) : null;
}

export async function listArtShowSearchBatches(runId: string): Promise<ArtShowSearchBatch[]> {
  const db = await getD1Database();
  if (!db) return [];

  const rows = await db
    .prepare(
      `SELECT * FROM art_show_search_batches
       WHERE run_id = ?1
       ORDER BY id ASC`
    )
    .bind(runId)
    .all<ArtShowSearchBatchRow>()
    .catch(() => ({ results: [] }));

  return rows.results.map(rowToSearchBatch);
}

export async function normalizePendingArtShowSearchBatches(
  runId: string,
  batchSize = artShowBatchSize
) {
  const db = await getD1Database();
  if (!db) return false;

  const pendingBatches = (await listArtShowSearchBatches(runId)).filter(
    (batch) => batch.status === "pending" && batch.termLabels.length > batchSize
  );
  if (!pendingBatches.length) return true;

  const statements = pendingBatches.flatMap((batch) => {
    const slices: string[][] = [];
    for (let index = 0; index < batch.termLabels.length; index += batchSize) {
      slices.push(batch.termLabels.slice(index, index + batchSize));
    }

    return [
      db
        .prepare(
          `UPDATE art_show_search_batches
           SET term_labels_json = ?1
           WHERE id = ?2
             AND status = 'pending'`
        )
        .bind(JSON.stringify(slices[0] ?? []), batch.id),
      ...slices.slice(1).map((labels, index) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO art_show_search_batches (
              id, run_id, status, term_labels_json, result_count, message,
              attempt_count, started_at, completed_at
            ) VALUES (?1, ?2, 'pending', ?3, 0, NULL, 0, NULL, NULL)`
          )
          .bind(`${batch.id}-split-${String(index + 2).padStart(2, "0")}`, runId, JSON.stringify(labels))
      )
    ];
  });

  const result = await db.batch(statements).catch(() => null);
  return Boolean(result);
}

export function progressFromBatches(batches: ArtShowSearchBatch[]): ArtShowSearchProgress {
  const currentBatch =
    batches.find((batch) => batch.status === "running") ??
    batches.find((batch) => batch.status === "pending");

  return {
    totalBatches: batches.length,
    completedBatches: batches.filter((batch) => batch.status === "complete").length,
    pendingBatches: batches.filter((batch) => batch.status === "pending").length,
    runningBatches: batches.filter((batch) => batch.status === "running").length,
    errorBatches: batches.filter((batch) => batch.status === "error").length,
    remainingTerms: batches
      .filter((batch) => batch.status === "pending" || batch.status === "running")
      .reduce((total, batch) => total + batch.termLabels.length, 0),
    currentBatch
  };
}

export async function getArtShowSearchProgress(
  run?: ArtShowSearchRun | null
): Promise<ArtShowSearchProgress | undefined> {
  if (!run) return undefined;
  return progressFromBatches(await listArtShowSearchBatches(run.id));
}

export async function claimNextArtShowSearchBatch(
  runId: string
): Promise<ArtShowSearchBatch | null> {
  const db = await getD1Database();
  if (!db) return null;

  await normalizePendingArtShowSearchBatches(runId);

  const row = await db
    .prepare(
      `SELECT * FROM art_show_search_batches
       WHERE run_id = ?1
         AND status = 'pending'
       ORDER BY id ASC
       LIMIT 1`
    )
    .bind(runId)
    .first<ArtShowSearchBatchRow>()
    .catch(() => null);

  if (!row) return null;

  const timestamp = nowIso();
  const result = await db
    .prepare(
      `UPDATE art_show_search_batches
       SET status = 'running',
           started_at = ?1,
           completed_at = NULL,
           message = NULL,
           attempt_count = attempt_count + 1
       WHERE id = ?2
         AND status = 'pending'`
    )
    .bind(timestamp, row.id)
    .run()
    .catch(() => null);

  if (!result) return null;

  return {
    ...rowToSearchBatch(row),
    status: "running",
    attemptCount: row.attempt_count + 1,
    startedAt: timestamp,
    completedAt: undefined,
    message: undefined
  };
}

export async function updateArtShowSearchBatch(
  id: string,
  input: {
    status: ArtShowSearchBatchStatus;
    resultCount?: number;
    message?: string;
  }
) {
  const db = await getD1Database();
  if (!db) return false;

  const timestamp = nowIso();
  const result = await db
    .prepare(
      `UPDATE art_show_search_batches
       SET status = ?1,
           result_count = ?2,
           message = ?3,
           completed_at = CASE WHEN ?1 = 'running' THEN completed_at ELSE ?4 END
       WHERE id = ?5`
    )
    .bind(input.status, input.resultCount ?? 0, input.message ?? null, timestamp, id)
    .run()
    .catch(() => null);

  return Boolean(result);
}

export async function summarizeArtShowSearchRun(runId: string) {
  const db = await getD1Database();
  if (!db) return false;

  const batches = await listArtShowSearchBatches(runId);
  if (!batches.length) return false;

  const resultCount = batches.reduce((total, batch) => total + batch.resultCount, 0);
  const incompleteCount = batches.filter(
    (batch) => batch.status === "pending" || batch.status === "running"
  ).length;
  const errorCount = batches.filter((batch) => batch.status === "error").length;

  if (incompleteCount > 0) {
    return updateArtShowSearchRun(runId, {
      status: "running",
      resultCount,
      message: `Searching batch ${
        batches.filter((batch) => batch.status === "complete").length + 1
      } of ${batches.length}.`
    });
  }

  return updateArtShowSearchRun(runId, {
    status: errorCount === batches.length ? "error" : "complete",
    resultCount,
      message:
      errorCount > 0
        ? `Finished with ${errorCount} timed-out batch${errorCount === 1 ? "" : "es"}. Start a new sweep later to continue remaining names.`
        : `Saved ${resultCount} sourced show lead${resultCount === 1 ? "" : "s"}.`
  });
}

export async function updateArtShowSearchRun(
  id: string,
  input: {
    status: ArtShowSearchRunStatus;
    resultCount?: number;
    message?: string;
  }
) {
  const db = await getD1Database();
  if (!db) return false;

  const timestamp = nowIso();
  const result = await db
    .prepare(
      `UPDATE art_show_search_runs
       SET status = ?1,
           result_count = ?2,
           message = ?3,
           completed_at = CASE WHEN ?1 = 'running' THEN completed_at ELSE ?4 END
       WHERE id = ?5`
    )
    .bind(
      input.status,
      input.resultCount ?? 0,
      input.message ?? null,
      timestamp,
      id
    )
    .run()
    .catch(() => null);

  return Boolean(result);
}
