import { getD1Database, nowIso } from "@/lib/storage/cloudflare";
import type { DestinationVote, DestinationVoteSummary } from "@/lib/types";

type DestinationVoteRow = {
  destination_slug: string;
  user_name: string;
  starred_at: string | null;
  hidden_at: string | null;
  updated_at: string;
};

export type DestinationVoteAction = "star" | "unstar" | "hide" | "unhide";

export type DestinationVoteState = {
  storageReady: boolean;
  votes: DestinationVote[];
  summaries: DestinationVoteSummary[];
};

export function normalizeDestinationVoteUserName(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ").slice(0, 40) ?? "";
}

function rowToVote(row: DestinationVoteRow): DestinationVote {
  return {
    destinationSlug: row.destination_slug,
    userName: row.user_name,
    starredAt: row.starred_at ?? undefined,
    hiddenAt: row.hidden_at ?? undefined,
    updatedAt: row.updated_at
  };
}

function newestIso(current: string | undefined, candidate: string | undefined) {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
}

export function summarizeDestinationVotes(votes: DestinationVote[]): DestinationVoteSummary[] {
  const bySlug = new Map<string, DestinationVoteSummary>();

  for (const vote of votes) {
    const summary = bySlug.get(vote.destinationSlug) ?? {
      destinationSlug: vote.destinationSlug,
      starCount: 0,
      hiddenCount: 0,
      starredBy: [],
      hiddenBy: []
    };

    if (vote.starredAt) {
      summary.starCount += 1;
      summary.starredBy.push(vote.userName);
      summary.latestStarredAt = newestIso(summary.latestStarredAt, vote.starredAt);
    }

    if (vote.hiddenAt) {
      summary.hiddenCount += 1;
      summary.hiddenBy.push(vote.userName);
    }

    summary.latestUpdatedAt = newestIso(summary.latestUpdatedAt, vote.updatedAt);
    bySlug.set(vote.destinationSlug, summary);
  }

  return [...bySlug.values()].map((summary) => ({
    ...summary,
    starredBy: summary.starredBy.sort((a, b) => a.localeCompare(b)),
    hiddenBy: summary.hiddenBy.sort((a, b) => a.localeCompare(b))
  }));
}

export async function listDestinationVoteState(): Promise<DestinationVoteState> {
  const db = await getD1Database();
  if (!db) return { storageReady: false, votes: [], summaries: [] };

  const rows = await db
    .prepare(
      `SELECT destination_slug, user_name, starred_at, hidden_at, updated_at
       FROM destination_votes
       WHERE starred_at IS NOT NULL OR hidden_at IS NOT NULL
       ORDER BY updated_at DESC
       LIMIT 1000`
    )
    .all<DestinationVoteRow>()
    .catch(() => ({ results: [] }));

  const votes = rows.results.map(rowToVote);
  return {
    storageReady: true,
    votes,
    summaries: summarizeDestinationVotes(votes)
  };
}

export async function updateDestinationVote(
  destinationSlug: string,
  userName: string,
  action: DestinationVoteAction
) {
  const db = await getD1Database();
  if (!db) return false;

  const timestamp = nowIso();
  const normalizedUserName = normalizeDestinationVoteUserName(userName);
  if (!destinationSlug || !normalizedUserName) return false;

  const starredAt = action === "star" ? timestamp : null;
  const hiddenAt = action === "hide" ? timestamp : null;
  const updateColumn =
    action === "star" || action === "unstar"
      ? "starred_at = ?3"
      : "hidden_at = ?4";

  const result = await db
    .prepare(
      `INSERT INTO destination_votes (
        destination_slug, user_name, starred_at, hidden_at, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
      ON CONFLICT(destination_slug, user_name) DO UPDATE SET
        ${updateColumn},
        updated_at = excluded.updated_at`
    )
    .bind(destinationSlug, normalizedUserName, starredAt, hiddenAt, timestamp)
    .run()
    .catch(() => null);

  return Boolean(result);
}
