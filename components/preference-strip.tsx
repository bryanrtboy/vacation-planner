"use client";

import { BedDouble, CalendarDays, History, MapPin, Palette, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  defaultTripPreferences,
  minimumFlightCountForLodging,
  normalizeFlightCount,
  readTripPreferences,
  savedSearchSelectedEvent,
  tripLengthLabel,
  writeTripPreferences
} from "@/lib/trip-preferences";
import type { SavedSearchSummary, TripPreferences } from "@/lib/types";

const airportOptions = [
  { code: "DEN", label: "Denver" },
  { code: "ABQ", label: "Albuquerque" },
  { code: "ATL", label: "Atlanta" },
  { code: "AUS", label: "Austin" },
  { code: "BNA", label: "Nashville" },
  { code: "BOS", label: "Boston" },
  { code: "BWI", label: "Baltimore" },
  { code: "CLT", label: "Charlotte" },
  { code: "DCA", label: "Washington Reagan" },
  { code: "DFW", label: "Dallas-Fort Worth" },
  { code: "DTW", label: "Detroit" },
  { code: "EWR", label: "Newark" },
  { code: "IAD", label: "Washington Dulles" },
  { code: "IAH", label: "Houston" },
  { code: "JFK", label: "New York JFK" },
  { code: "LAS", label: "Las Vegas" },
  { code: "LAX", label: "Los Angeles" },
  { code: "MCO", label: "Orlando" },
  { code: "MIA", label: "Miami" },
  { code: "MSP", label: "Minneapolis-Saint Paul" },
  { code: "ORD", label: "Chicago O'Hare" },
  { code: "PDX", label: "Portland" },
  { code: "PHL", label: "Philadelphia" },
  { code: "PHX", label: "Phoenix" },
  { code: "SAN", label: "San Diego" },
  { code: "SEA", label: "Seattle" },
  { code: "SFO", label: "San Francisco" },
  { code: "SLC", label: "Salt Lake City" }
];

const nightOptions = [
  { value: 5, label: "5 nights" },
  { value: 7, label: "7 nights" },
  { value: 10, label: "10 nights" },
  { value: 14, label: "14 nights" },
  { value: 21, label: "21 nights" },
  { value: 28, label: "28 nights" }
];

const lodgingOptions = [
  "rentals first",
  "hotels",
  "apartments for 2",
  "group house rentals",
  "best total value"
];

const interestOptions = [
  "art · food · gardens",
  "art · craft · coast",
  "food · trains · architecture",
  "gardens · landscape · quiet bases",
  "relaxation · recharging · beautiful settings",
  "bay · ocean views · food",
  "rural escape · slow days",
  "fly-fishing · scenic walks",
  "bread-making · culinary classes",
  "custom"
];

function normalizeNights(value: number) {
  if (!Number.isFinite(value)) return defaultTripPreferences.nights;
  return Math.min(Math.max(Math.round(value), 1), 60);
}

export function PreferenceStrip() {
  const [preferences, setPreferences] = useState<TripPreferences>(defaultTripPreferences);
  const [customNightsOpen, setCustomNightsOpen] = useState(false);
  const [customInterestsOpen, setCustomInterestsOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearchSummary[]>([]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const storedPreferences = readTripPreferences();
      setPreferences(storedPreferences);
      setCustomNightsOpen(
        !nightOptions.some((option) => option.value === storedPreferences.nights)
      );
      setCustomInterestsOpen(!interestOptions.includes(storedPreferences.interests));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedSearches() {
      try {
        const response = await fetch("/api/saved-searches");
        if (!response.ok) return;
        const data = (await response.json()) as { savedSearches?: SavedSearchSummary[] };
        if (!cancelled) setSavedSearches(data.savedSearches ?? []);
      } catch {
        // Recent shared saves are optional; local preferences still work without D1.
      }
    }

    void loadSavedSearches();

    return () => {
      cancelled = true;
    };
  }, []);

  function updatePreferences(next: Partial<TripPreferences>) {
    const nextPreferences = {
      ...preferences,
      ...next
    };
    nextPreferences.departure = nextPreferences.departure.trim().toUpperCase();
    nextPreferences.flightCount = normalizeFlightCount(nextPreferences.flightCount);
    nextPreferences.nights = normalizeNights(nextPreferences.nights);
    nextPreferences.flightCount = Math.max(
      nextPreferences.flightCount,
      minimumFlightCountForLodging(nextPreferences.lodging)
    );
    setPreferences(nextPreferences);
    writeTripPreferences(nextPreferences);
  }

  function fieldClass() {
    return "mt-1 w-full rounded-md border border-ink/12 bg-white px-2.5 py-1.5 text-sm font-semibold text-ink/78 outline-none transition focus:border-harbor/55";
  }

  const selectedNightValue = nightOptions.some((option) => option.value === preferences.nights)
    ? String(preferences.nights)
    : "custom";
  const selectedInterest = !customInterestsOpen && interestOptions.includes(preferences.interests)
    ? preferences.interests
    : "custom";

  return (
    <section className="grid gap-2" aria-label="Default trip preferences">
      {savedSearches.length ? (
        <label className="rounded-md border border-ink/8 bg-white/50 px-3 py-2">
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink/38">
            <History size={15} className="text-harbor/72" aria-hidden="true" />
            Recent saved checks
          </span>
          <select
            className={fieldClass()}
            defaultValue=""
            onChange={(event) => {
              const savedSearch = savedSearches.find((item) => item.id === event.target.value);
              if (!savedSearch) return;
              const next: Partial<TripPreferences> = {};
              if (savedSearch.departure) next.departure = savedSearch.departure;
              if (savedSearch.flightCount) next.flightCount = savedSearch.flightCount;
              if (savedSearch.nights) next.nights = savedSearch.nights;
              if (savedSearch.lodging) next.lodging = savedSearch.lodging;
              if (savedSearch.departDate && savedSearch.returnDate) {
                next.departDate = savedSearch.departDate;
                next.returnDate = savedSearch.returnDate;
                next.travelSeason = "saved";
              }

              setCustomNightsOpen(
                Boolean(savedSearch.nights) &&
                  !nightOptions.some((option) => option.value === savedSearch.nights)
              );
              updatePreferences(next);
              window.dispatchEvent(
                new CustomEvent(savedSearchSelectedEvent, {
                  detail: savedSearch
                })
              );
              event.target.value = "";
            }}
          >
            <option value="">Open a recent saved check...</option>
            {savedSearches.map((savedSearch) => (
              <option key={savedSearch.id} value={savedSearch.id}>
                {savedSearch.label} · {savedSearch.detail}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] font-medium text-ink/42">
            Opens that destination with its saved dates and settings.
          </span>
        </label>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <label className="rounded-md border border-ink/8 bg-white/50 px-3 py-2">
        <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink/38">
          <MapPin size={15} className="text-harbor/72" aria-hidden="true" />
          Departure
        </span>
        <input
          className={fieldClass()}
          list="departure-airports"
          value={preferences.departure}
          onChange={(event) => updatePreferences({ departure: event.target.value })}
        />
        <datalist id="departure-airports">
          {airportOptions.map((airport) => (
            <option key={airport.code} value={airport.code} label={`${airport.code} · ${airport.label}`} />
          ))}
        </datalist>
      </label>

      <label className="rounded-md border border-ink/8 bg-white/50 px-3 py-2">
        <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink/38">
          <Users size={15} className="text-harbor/72" aria-hidden="true" />
          Flights
        </span>
        <input
          className={fieldClass()}
          type="number"
          min={1}
          max={8}
          value={preferences.flightCount}
          onChange={(event) => updatePreferences({ flightCount: Number(event.target.value) })}
        />
        <span className="mt-1 block text-[11px] font-medium text-ink/42">
          {preferences.flightCount} {preferences.flightCount === 1 ? "ticket" : "tickets"}
        </span>
      </label>

      <label className="rounded-md border border-ink/8 bg-white/50 px-3 py-2">
        <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink/38">
          <CalendarDays size={15} className="text-harbor/72" aria-hidden="true" />
          Room nights
        </span>
        <select
          className={fieldClass()}
          value={customNightsOpen ? "custom" : selectedNightValue}
          onChange={(event) => {
            if (event.target.value === "custom") {
              setCustomNightsOpen(true);
              return;
            }
            setCustomNightsOpen(false);
            updatePreferences({ nights: Number(event.target.value) });
          }}
        >
          {nightOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
        {customNightsOpen ? (
          <input
            className={`${fieldClass()} mt-2`}
            type="number"
            min={1}
            max={60}
            value={preferences.nights}
            onChange={(event) => updatePreferences({ nights: Number(event.target.value) })}
          />
        ) : (
          <span className="mt-1 block text-[11px] font-medium text-ink/42">
            {tripLengthLabel(preferences.nights)}
          </span>
        )}
      </label>

      <label className="rounded-md border border-ink/8 bg-white/50 px-3 py-2">
        <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink/38">
          <BedDouble size={15} className="text-harbor/72" aria-hidden="true" />
          Lodging
        </span>
        <select
          className={fieldClass()}
          value={preferences.lodging}
          onChange={(event) => {
            const lodging = event.target.value;
            updatePreferences({
              lodging,
              flightCount: Math.max(preferences.flightCount, minimumFlightCountForLodging(lodging))
            });
          }}
        >
          {lodgingOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="rounded-md border border-ink/8 bg-white/50 px-3 py-2">
        <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink/38">
          <Palette size={15} className="text-harbor/72" aria-hidden="true" />
          Interests
        </span>
        <select
          className={fieldClass()}
          value={selectedInterest}
          onChange={(event) => {
            if (event.target.value === "custom") {
              setCustomInterestsOpen(true);
              return;
            }
            setCustomInterestsOpen(false);
            updatePreferences({ interests: event.target.value });
          }}
        >
          {interestOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {selectedInterest === "custom" ? (
          <input
            className={`${fieldClass()} mt-2`}
            value={preferences.interests}
            onChange={(event) => updatePreferences({ interests: event.target.value })}
          />
        ) : null}
      </label>
      </div>
    </section>
  );
}
