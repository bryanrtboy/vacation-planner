import { WATCH_DAILY_CAP } from "@/lib/settings";
import { getD1Database, nowIso } from "@/lib/storage/cloudflare";
import type { UsageState } from "@/lib/types";

type MutableUsageState = {
  day: string;
  used: number;
};

const globalUsage = globalThis as typeof globalThis & {
  artistTravelFinderUsage?: Record<string, MutableUsageState>;
};

const defaultService = "serpapi";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function currentUsage(service: string): MutableUsageState {
  const day = todayKey();
  globalUsage.artistTravelFinderUsage ??= {};
  const usage = globalUsage.artistTravelFinderUsage[service];
  if (!usage || usage.day !== day) {
    globalUsage.artistTravelFinderUsage[service] = { day, used: 0 };
  }

  return globalUsage.artistTravelFinderUsage[service];
}

function usageState(usage: MutableUsageState): UsageState {
  return {
    day: usage.day,
    used: usage.used,
    limit: WATCH_DAILY_CAP,
    remaining: Math.max(WATCH_DAILY_CAP - usage.used, 0)
  };
}

function fallbackUsageState(service: string) {
  return usageState(currentUsage(service));
}

export async function getUsageState(service = defaultService): Promise<UsageState> {
  const db = await getD1Database();
  const day = todayKey();
  if (!db) return fallbackUsageState(service);

  const row = await db
    .prepare("SELECT used FROM usage_counters WHERE service = ?1 AND day = ?2")
    .bind(service, day)
    .first<{ used: number }>()
    .catch(() => null);

  if (!row) return usageState({ day, used: 0 });
  return usageState({ day, used: row.used });
}

export async function tryReserveChecks(count: number, service = defaultService) {
  const db = await getD1Database();
  if (!db) {
    const usage = currentUsage(service);
    const remaining = Math.max(WATCH_DAILY_CAP - usage.used, 0);
    const allowed = Math.min(count, remaining);
    usage.used += allowed;

    return {
      allowed,
      usage: fallbackUsageState(service)
    };
  }

  const day = todayKey();
  const timestamp = nowIso();

  await db
    .prepare(
      `INSERT INTO usage_counters (service, day, used, updated_at)
       VALUES (?1, ?2, 0, ?3)
       ON CONFLICT(service, day) DO NOTHING`
    )
    .bind(service, day, timestamp)
    .run()
    .catch(() => undefined);

  const row = await db
    .prepare("SELECT used FROM usage_counters WHERE service = ?1 AND day = ?2")
    .bind(service, day)
    .first<{ used: number }>()
    .catch(() => null);

  if (!row) {
    const usage = currentUsage(service);
    const remaining = Math.max(WATCH_DAILY_CAP - usage.used, 0);
    const allowed = Math.min(count, remaining);
    usage.used += allowed;
    return { allowed, usage: fallbackUsageState(service) };
  }

  const usage = { day, used: row.used };
  const remaining = Math.max(WATCH_DAILY_CAP - usage.used, 0);
  const allowed = Math.min(count, remaining);
  const nextUsed = usage.used + allowed;

  await db
    .prepare("UPDATE usage_counters SET used = ?1, updated_at = ?2 WHERE service = ?3 AND day = ?4")
    .bind(nextUsed, timestamp, service, day)
    .run()
    .catch(() => undefined);

  return {
    allowed,
    usage: usageState({ day, used: nextUsed })
  };
}
