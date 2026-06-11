"use client";

import { BedDouble, CalendarDays, MapPin, Palette } from "lucide-react";
import { useEffect, useState } from "react";
import {
  defaultTripPreferences,
  readTripPreferences,
  tripLengthLabel,
  writeTripPreferences
} from "@/lib/trip-preferences";
import type { TripPreferences } from "@/lib/types";

const items = [
  {
    icon: MapPin,
    key: "departure",
    label: "Departure",
    title: "Departure airport or city"
  },
  {
    icon: CalendarDays,
    key: "nights",
    label: "Room nights",
    title: "Number of room nights"
  },
  {
    icon: BedDouble,
    key: "lodging",
    label: "Lodging",
    title: "Lodging preference"
  },
  {
    icon: Palette,
    key: "interests",
    label: "Interests",
    title: "Travel style"
  }
] as const;

export function PreferenceStrip() {
  const [preferences, setPreferences] = useState<TripPreferences>(defaultTripPreferences);

  useEffect(() => {
    const id = window.setTimeout(() => setPreferences(readTripPreferences()), 0);
    return () => window.clearTimeout(id);
  }, []);

  function displayValue(key: keyof TripPreferences) {
    if (key === "nights") return tripLengthLabel(preferences.nights);
    return preferences[key];
  }

  function editPreference(key: keyof TripPreferences, title: string) {
    const nextValue = window.prompt(title, String(preferences[key]));
    if (!nextValue?.trim()) return;
    const nextPreferences = {
      ...preferences,
      [key]:
        key === "nights"
          ? Math.min(Math.max(Math.round(Number(nextValue.trim())), 1), 60)
          : nextValue.trim()
    };
    if (!Number.isFinite(nextPreferences.nights)) nextPreferences.nights = preferences.nights;
    nextPreferences.departure = nextPreferences.departure.toUpperCase();
    setPreferences(nextPreferences);
    writeTripPreferences(nextPreferences);
  }

  return (
    <section
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Default trip preferences"
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => editPreference(item.key, item.title)}
          className="flex items-center gap-3 rounded-md border border-ink/8 bg-white/50 px-3 py-2 text-left transition hover:border-harbor/35 hover:bg-white"
          title={`Edit ${item.title}`}
        >
          <item.icon size={15} className="shrink-0 text-harbor/72" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink/38">
              {item.label}
            </span>
            <span className="block truncate text-sm font-semibold text-ink/78">
              {displayValue(item.key)}
            </span>
          </span>
        </button>
      ))}
    </section>
  );
}
