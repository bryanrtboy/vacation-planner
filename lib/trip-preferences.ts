import { defaultPreferences } from "@/lib/settings";
import type { Destination, TripPreferences, TripWindow } from "@/lib/types";

export const tripPreferencesStorageKey = "artist-travel-finder:preferences";
export const tripPreferencesChangedEvent = "artist-travel-finder:preferences-changed";

export const defaultTripPreferences: TripPreferences = {
  departure: defaultPreferences.homeAirport,
  nights: 7,
  lodging: "rentals first",
  interests: "art · food · gardens"
};

const recommendedDepartDates: Record<string, { date: string; reason: string }> = {
  "lisbon-coast": {
    date: "2027-03-11",
    reason: "early spring shoulder season inside March-May"
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

function normalizeNights(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultTripPreferences.nights;
  return Math.min(Math.max(Math.round(parsed), 1), 60);
}

export function readTripPreferences(): TripPreferences {
  if (typeof window === "undefined") return defaultTripPreferences;
  const raw = window.localStorage.getItem(tripPreferencesStorageKey);
  if (!raw) return defaultTripPreferences;

  try {
    const parsed = JSON.parse(raw) as Partial<TripPreferences & { length?: string }>;
    const legacyLength = parsed.length?.match(/\d+/)?.[0];
    return {
      ...defaultTripPreferences,
      ...parsed,
      departure: (parsed.departure ?? defaultTripPreferences.departure).trim().toUpperCase(),
      nights: normalizeNights(parsed.nights ?? legacyLength)
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

export function recommendedTripWindow(destination: Destination, nights: number): TripWindow {
  const recommended = recommendedDepartDates[destination.slug] ?? {
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
