import { WATCH_DAILY_CAP } from "@/lib/settings";
import type { UsageState } from "@/lib/types";

type MutableUsageState = {
  day: string;
  used: number;
};

const globalUsage = globalThis as typeof globalThis & {
  artistTravelFinderUsage?: MutableUsageState;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function currentUsage(): MutableUsageState {
  const day = todayKey();
  if (!globalUsage.artistTravelFinderUsage || globalUsage.artistTravelFinderUsage.day !== day) {
    globalUsage.artistTravelFinderUsage = { day, used: 0 };
  }

  return globalUsage.artistTravelFinderUsage;
}

export function getUsageState(): UsageState {
  const usage = currentUsage();
  return {
    day: usage.day,
    used: usage.used,
    limit: WATCH_DAILY_CAP,
    remaining: Math.max(WATCH_DAILY_CAP - usage.used, 0)
  };
}

export function tryReserveChecks(count: number) {
  const usage = currentUsage();
  const remaining = Math.max(WATCH_DAILY_CAP - usage.used, 0);
  const allowed = Math.min(count, remaining);
  usage.used += allowed;

  return {
    allowed,
    usage: getUsageState()
  };
}
