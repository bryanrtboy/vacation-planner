import { AI_DAILY_CAP, SERPAPI_DAILY_CAP, USAGE_COUNTER_TIME_ZONE } from "@/lib/settings";
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

function limitForService(service: string) {
  if (service === "ai" || service === "gemini" || service === "openai") return AI_DAILY_CAP;
  return SERPAPI_DAILY_CAP;
}

function dateKeyForTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return date.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

function timeZoneOffsetMinutes(date: Date, timeZone: string) {
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset"
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = timeZoneName?.match(/^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  return sign * (hours * 60 + minutes);
}

function usageDayStartIso(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return null;

  const noonUtc = new Date(Date.UTC(year, month - 1, date, 12));
  const offsetMinutes = timeZoneOffsetMinutes(noonUtc, USAGE_COUNTER_TIME_ZONE);
  return new Date(Date.UTC(year, month - 1, date) - offsetMinutes * 60 * 1000).toISOString();
}

function isStaleCounterRow(updatedAt: string | null | undefined, day: string) {
  if (!updatedAt) return false;
  const dayStart = usageDayStartIso(day);
  if (!dayStart) return false;

  const updatedTime = Date.parse(updatedAt);
  const startTime = Date.parse(dayStart);
  return Number.isFinite(updatedTime) && Number.isFinite(startTime) && updatedTime < startTime;
}

function todayKey() {
  try {
    return dateKeyForTimeZone(new Date(), USAGE_COUNTER_TIME_ZONE);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
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

function usageState(usage: MutableUsageState, service: string): UsageState {
  const limit = limitForService(service);
  return {
    day: usage.day,
    used: usage.used,
    limit,
    remaining: Math.max(limit - usage.used, 0)
  };
}

function fallbackUsageState(service: string) {
  return usageState(currentUsage(service), service);
}

export async function getUsageState(service = defaultService): Promise<UsageState> {
  const db = await getD1Database();
  const day = todayKey();
  if (!db) return fallbackUsageState(service);

  const row = await db
    .prepare("SELECT used, updated_at FROM usage_counters WHERE service = ?1 AND day = ?2")
    .bind(service, day)
    .first<{ used: number; updated_at: string }>()
    .catch(() => null);

  if (row && isStaleCounterRow(row.updated_at, day)) {
    await db
      .prepare("UPDATE usage_counters SET used = 0, updated_at = ?1 WHERE service = ?2 AND day = ?3")
      .bind(nowIso(), service, day)
      .run()
      .catch(() => undefined);
    return usageState({ day, used: 0 }, service);
  }

  if (!row) return usageState({ day, used: 0 }, service);
  return usageState({ day, used: row.used }, service);
}

export async function tryReserveChecks(count: number, service = defaultService) {
  const db = await getD1Database();
  if (!db) {
    const usage = currentUsage(service);
    const limit = limitForService(service);
    const remaining = Math.max(limit - usage.used, 0);
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
    .prepare("SELECT used, updated_at FROM usage_counters WHERE service = ?1 AND day = ?2")
    .bind(service, day)
    .first<{ used: number; updated_at: string }>()
    .catch(() => null);

  if (!row) {
    const usage = currentUsage(service);
    const limit = limitForService(service);
    const remaining = Math.max(limit - usage.used, 0);
    const allowed = Math.min(count, remaining);
    usage.used += allowed;
    return { allowed, usage: fallbackUsageState(service) };
  }

  const usage = {
    day,
    used: isStaleCounterRow(row.updated_at, day) ? 0 : row.used
  };
  const limit = limitForService(service);
  const remaining = Math.max(limit - usage.used, 0);
  const allowed = Math.min(count, remaining);
  const nextUsed = usage.used + allowed;

  await db
    .prepare("UPDATE usage_counters SET used = ?1, updated_at = ?2 WHERE service = ?3 AND day = ?4")
    .bind(nextUsed, timestamp, service, day)
    .run()
    .catch(() => undefined);

  return {
    allowed,
    usage: usageState({ day, used: nextUsed }, service)
  };
}

export async function releaseReservedChecks(count: number, service = defaultService) {
  if (count <= 0) return getUsageState(service);

  const db = await getD1Database();
  if (!db) {
    const usage = currentUsage(service);
    usage.used = Math.max(usage.used - count, 0);
    return fallbackUsageState(service);
  }

  const day = todayKey();
  const timestamp = nowIso();

  await db
    .prepare(
      `UPDATE usage_counters
       SET used = MAX(used - ?1, 0), updated_at = ?2
       WHERE service = ?3 AND day = ?4`
    )
    .bind(count, timestamp, service, day)
    .run()
    .catch(() => undefined);

  return getUsageState(service);
}
