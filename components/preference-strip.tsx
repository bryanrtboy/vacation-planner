"use client";

import { BedDouble, CalendarDays, MapPin, Palette } from "lucide-react";
import { useEffect, useState } from "react";
import { defaultPreferences } from "@/lib/settings";

const storageKey = "artist-travel-finder:preferences";

type PreferenceValues = {
  departure: string;
  length: string;
  lodging: string;
  interests: string;
};

const defaults: PreferenceValues = {
  departure: defaultPreferences.homeAirport,
  length: defaultPreferences.tripLength,
  lodging: "rentals first",
  interests: "art · food · gardens"
};

const items = [
  {
    icon: MapPin,
    key: "departure",
    label: "Departure",
    title: "Departure airport or city"
  },
  {
    icon: CalendarDays,
    key: "length",
    label: "Length",
    title: "Default trip length"
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

function readPreferences() {
  if (typeof window === "undefined") return defaults;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(raw) as Partial<PreferenceValues>) };
  } catch {
    return defaults;
  }
}

export function PreferenceStrip() {
  const [preferences, setPreferences] = useState<PreferenceValues>(defaults);

  useEffect(() => {
    const id = window.setTimeout(() => setPreferences(readPreferences()), 0);
    return () => window.clearTimeout(id);
  }, []);

  function editPreference(key: keyof PreferenceValues, title: string) {
    const nextValue = window.prompt(title, preferences[key]);
    if (!nextValue?.trim()) return;
    const nextPreferences = { ...preferences, [key]: nextValue.trim() };
    setPreferences(nextPreferences);
    window.localStorage.setItem(storageKey, JSON.stringify(nextPreferences));
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
              {preferences[item.key]}
            </span>
          </span>
        </button>
      ))}
    </section>
  );
}
