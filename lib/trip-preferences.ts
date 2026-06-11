import { defaultPreferences } from "@/lib/settings";
import type { Destination, TripPreferences, TripSeason, TripWindow } from "@/lib/types";

export const tripPreferencesStorageKey = "artist-travel-finder:preferences";
export const tripPreferencesChangedEvent = "artist-travel-finder:preferences-changed";

export const defaultTripPreferences: TripPreferences = {
  departure: defaultPreferences.homeAirport,
  flightCount: 2,
  nights: 7,
  lodging: "rentals first",
  interests: "art · food · gardens",
  travelSeason: "recommended"
};

const recommendedDepartDates: Record<string, { date: string; reason: string }> = {
  "lisbon-coast": {
    date: "2026-11-03",
    reason: "early November shoulder season inside late September-November"
  },
  "bologna-emilia": {
    date: "2026-11-05",
    reason: "late fall shoulder season inside September-November"
  },
  essaouira: {
    date: "2026-11-03",
    reason: "November shoulder season inside October-November"
  },
  "graz-styria": {
    date: "2026-10-07",
    reason: "early October shoulder season inside September-October"
  }
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return isoDate(date);
}

const monthNumbers: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12
};

const tripSeasonLabels: Record<Exclude<TripSeason, "saved">, string> = {
  recommended: "Recommended",
  spring: "Spring",
  fall: "Fall"
};

function monthsInBestMonths(bestMonths: string) {
  const normalized = bestMonths.toLowerCase();
  return Object.entries(monthNumbers)
    .filter(([month]) => normalized.includes(month))
    .map(([, value]) => value);
}

function futureDateForMonth(month: number) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const year = month <= currentMonth ? currentYear + 1 : currentYear;
  const day = month === 9 ? 22 : 15;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function seasonalDate(destination: Destination, season: TripSeason) {
  const months = monthsInBestMonths(destination.bestMonths);
  const seasonalMonths =
    season === "spring" ? [3, 4, 5, 6] : season === "fall" ? [9, 10, 11] : [];
  const month = seasonalMonths.find((candidate) => months.includes(candidate));
  if (!month) return undefined;
  return futureDateForMonth(month);
}

function normalizeNights(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultTripPreferences.nights;
  return Math.min(Math.max(Math.round(parsed), 1), 60);
}

export function normalizeFlightCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultTripPreferences.flightCount;
  return Math.min(Math.max(Math.round(parsed), 1), 8);
}

export function minimumFlightCountForLodging(lodging: string) {
  const normalized = lodging.toLowerCase();
  if (normalized.includes("group") || normalized.includes("house")) return 4;
  if (normalized.includes("apartment") || normalized.includes("for 2")) return 2;
  return 1;
}

export function readTripPreferences(): TripPreferences {
  if (typeof window === "undefined") return defaultTripPreferences;
  const raw = window.localStorage.getItem(tripPreferencesStorageKey);
  if (!raw) return defaultTripPreferences;

  try {
    const parsed = JSON.parse(raw) as Partial<TripPreferences & { length?: string }>;
    const legacyLength = parsed.length?.match(/\d+/)?.[0];
    const lodging = parsed.lodging ?? defaultTripPreferences.lodging;
    const flightCount = Math.max(
      normalizeFlightCount(parsed.flightCount),
      minimumFlightCountForLodging(lodging)
    );
    return {
      ...defaultTripPreferences,
      ...parsed,
      departure: (parsed.departure ?? defaultTripPreferences.departure).trim().toUpperCase(),
      flightCount,
      nights: normalizeNights(parsed.nights ?? legacyLength),
      travelSeason: parsed.travelSeason ?? defaultTripPreferences.travelSeason
    };
  } catch {
    return defaultTripPreferences;
  }
}

export function writeTripPreferences(preferences: TripPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(tripPreferencesStorageKey, JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent(tripPreferencesChangedEvent));
}

export function tripSeasonOptions(destination: Destination) {
  const months = monthsInBestMonths(destination.bestMonths);
  const options: { value: Exclude<TripSeason, "saved">; label: string }[] = [
    { value: "recommended", label: tripSeasonLabels.recommended }
  ];
  if ([3, 4, 5, 6].some((month) => months.includes(month))) {
    options.push({ value: "spring", label: tripSeasonLabels.spring });
  }
  if ([9, 10, 11].some((month) => months.includes(month))) {
    options.push({ value: "fall", label: tripSeasonLabels.fall });
  }
  return options;
}

export function recommendedTripWindow(
  destination: Destination,
  input: number | Pick<TripPreferences, "nights" | "travelSeason" | "departDate" | "returnDate">
): TripWindow {
  const nights = typeof input === "number" ? input : normalizeNights(input.nights);
  if (typeof input !== "number" && input.departDate && input.returnDate) {
    return {
      departDate: input.departDate,
      returnDate: input.returnDate,
      label: `${input.departDate} to ${input.returnDate}`,
      reason: "saved checked dates"
    };
  }

  const requestedSeason = typeof input === "number" ? "recommended" : input.travelSeason;
  const seasonalDepartDate =
    requestedSeason && requestedSeason !== "recommended" && requestedSeason !== "saved"
      ? seasonalDate(destination, requestedSeason)
      : undefined;
  const recommended = seasonalDepartDate
    ? {
        date: seasonalDepartDate,
        reason: `${tripSeasonLabels[requestedSeason as "spring" | "fall"].toLowerCase()} planning window inside ${destination.bestMonths}`
      }
    : recommendedDepartDates[destination.slug] ?? {
        date: destination.flightSearch.departDate,
        reason: `seeded date inside ${destination.bestMonths}`
      };
  const returnDate = addDays(recommended.date, nights);

  return {
    departDate: recommended.date,
    returnDate,
    label: `${recommended.date} to ${returnDate}`,
    reason: recommended.reason
  };
}

export function tripLengthLabel(nights: number) {
  return `${nights} ${nights === 1 ? "night" : "nights"}`;
}
