"use client";

import { type ReactNode, useState } from "react";
import Image from "next/image";
import {
  Car,
  ChevronDown,
  ExternalLink,
  Image as ImageIcon,
  Info,
  MapPin,
  Plane,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";
import { googleFlightsSearchUrl } from "@/lib/flights/links";
import { lodgingModes, type LodgingMode, type LodgingModeId } from "@/lib/lodging/modes";
import { tripLengthLabel, tripSeasonOptions } from "@/lib/trip-preferences";
import type {
  Destination,
  PriceRange,
  SavedSearchSummary,
  TripPreferences,
  TripWindow,
  UsageState,
  WatchRefreshResult
} from "@/lib/types";

function scoreLabel(label: string) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function ScoreRating({ label, value }: { label: string; value: number }) {
  const rating = Math.max(0, Math.min(5, value / 2));
  const ariaRating = Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

  return (
    <span
      className="inline-flex min-w-28 items-center justify-between gap-2 rounded-md border border-ink/8 bg-white/55 px-2 py-1"
      aria-label={`${scoreLabel(label)} ${ariaRating} of 5 stars`}
      title={`${scoreLabel(label)} ${ariaRating} of 5 stars`}
    >
      <span className="text-[11px] font-semibold text-ink/62">{scoreLabel(label)}</span>
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="relative inline-flex size-3">
            <Star size={12} className="fill-transparent text-ink/18" />
            <span
              className="absolute inset-0 overflow-hidden text-[#c48a2a]"
              style={{ width: `${Math.max(0, Math.min(1, rating - index)) * 100}%` }}
            >
              <Star size={12} className="fill-current" />
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

function mapsUrl(destination: Destination) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    destination.mapQuery
  )}`;
}

function imageSearchUrl(destination: Destination) {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(
    `${destination.name} ${destination.region} travel`
  )}`;
}

function priceLabel(range: { min: number; max: number }, suffix: string) {
  return `$${range.min.toLocaleString()}-$${range.max.toLocaleString()} ${suffix}`;
}

function flightCountLabel(count: number) {
  return `${count} ${count === 1 ? "ticket" : "tickets"}`;
}

function airfareLabel(range: { min: number; max: number }, flightCount: number) {
  return `${priceLabel(range, "total airfare")} · ${flightCountLabel(flightCount)}`;
}

function moneyLabel(value: number) {
  return `$${value.toLocaleString()}`;
}

function unitPriceLabel(range: { min: number; max: number }, suffix: string) {
  return `$${range.min.toLocaleString()}-$${range.max.toLocaleString()}${suffix}`;
}

function shortDate(value: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function travelDateLabel(tripWindow: TripWindow) {
  return `${shortDate(tripWindow.departDate)}-${shortDate(tripWindow.returnDate)}`;
}

function roundedCost(value: number) {
  return `$${(Math.round(value / 50) * 50).toLocaleString()}`;
}

function rangeMidpoint(range: { min: number; max: number }) {
  if (range.max <= 0) return undefined;
  return (range.min + range.max) / 2;
}

function lodgingCostEstimate(
  lodgingSnapshot?: WatchRefreshResult
) {
  if (lodgingSnapshot?.status === "checked" && lodgingSnapshot.currentRange) {
    return rangeMidpoint(lodgingSnapshot.currentRange);
  }

  return undefined;
}

function diningCostEstimate(destination: Destination, nights: number) {
  const dailyMidpoint = rangeMidpoint(destination.dining);
  return typeof dailyMidpoint === "number" ? dailyMidpoint * nights : undefined;
}

function missingCostPhrase(missing: string[]) {
  if (missing.length === 1) return missing[0];
  if (missing.length === 2) return `${missing[0]} and ${missing[1]}`;
  return `${missing.slice(0, -1).join(", ")}, and ${missing.at(-1)}`;
}

function tripCostSummary(
  destination: Destination,
  airfare: PriceRange | undefined,
  nights: number,
  travelMode: TripPreferences["travelMode"],
  lodgingSnapshot?: WatchRefreshResult,
  unavailable?: WatchRefreshResult,
  isCheckingFare?: boolean,
  isCheckingLodging?: boolean
) {
  const isDriving = travelMode === "drive";
  const airfareCost = !isDriving && airfare ? rangeMidpoint(airfare) : undefined;
  const lodgingCost = lodgingCostEstimate(lodgingSnapshot);
  const diningCost = diningCostEstimate(destination, nights);
  const knownCosts = [airfareCost, lodgingCost, diningCost].filter(
    (value): value is number => typeof value === "number"
  );
  const total = knownCosts.reduce((sum, value) => sum + value, 0);
  const missing = [
    !isDriving && (!airfare || unavailable) ? "airfare" : undefined,
    typeof lodgingCost !== "number" ? "lodging" : undefined,
    typeof diningCost !== "number" && destination.dining.sourceKind !== "unavailable"
      ? "dining"
      : undefined
  ].filter((value): value is string => Boolean(value));
  const checking = (!isDriving && isCheckingFare) || isCheckingLodging;

  if (!knownCosts.length) {
    return checking ? "Cost not checked yet; checking prices." : "Cost not checked yet.";
  }

  const suffix = missing.length ? ` before ${missingCostPhrase(missing)}` : "";
  const checkingSuffix = checking ? "; checking prices" : "";

  return `Cost around ${roundedCost(total)}${suffix}${checkingSuffix}.`;
}

function compactLodgingLabel(mode: LodgingMode) {
  if (mode.id === "hotel") return "hotel";
  if (mode.id === "group-house") return "group house";
  return "apartment";
}

function compactTripSetup(nights: number, lodgingMode: LodgingMode, travelMode: TripPreferences["travelMode"]) {
  const travel = travelMode === "drive" ? "driving" : undefined;
  const lodging = compactLodgingLabel(lodgingMode);
  return travel
    ? `${tripLengthLabel(nights)}, ${travel} + ${lodging}`
    : `${tripLengthLabel(nights)} + ${lodging}`;
}

function compactTripCostSummary(
  summary: string,
  nights: number,
  lodgingMode: LodgingMode,
  travelMode: TripPreferences["travelMode"]
) {
  const compact = summary
    .replace(/^Cost around\s+/i, "")
    .replace(/^Cost\s+/i, "")
    .replace(/\.$/, "");

  if (travelMode === "drive" && (compact.includes(" before lodging") || compact.includes("checking"))) {
    return compactTripSetup(nights, lodgingMode, travelMode);
  }

  if (!compact.startsWith("$") || compact.includes(" before ") || compact.includes("checking")) {
    return compact;
  }

  return `${compact} – ${compactTripSetup(nights, lodgingMode, travelMode)}`;
}

function rangeLabel(range: { min: number; max: number }) {
  return `$${range.min.toLocaleString()}-$${range.max.toLocaleString()}`;
}

function resultAirfare(
  destination: Destination,
  result: WatchRefreshResult,
  flightCount: number
): PriceRange {
  if (!result.currentRange) return destination.airfare;

  return {
    ...destination.airfare,
    min: result.currentRange.min,
    max: result.currentRange.max,
    label: airfareLabel(result.currentRange, flightCount),
    provider: result.provider ?? destination.airfare.provider,
    sampledDates: result.sampledDates ?? destination.airfare.sampledDates,
    retrievedAt: result.retrievedAt ?? destination.airfare.retrievedAt,
    sourceUrl: result.sourceUrl ?? destination.airfare.sourceUrl,
    sourceDetail: result.sourceDetail ?? destination.airfare.sourceDetail,
    sourceKind: result.sourceKind
  };
}

function snapshotAirfare(
  destination: Destination,
  fareSnapshot: WatchRefreshResult | undefined,
  flightCount: number
): PriceRange | undefined {
  if (fareSnapshot?.status === "checked") return resultAirfare(destination, fareSnapshot, flightCount);
  return undefined;
}

function unavailableAirfare(fareSnapshot?: WatchRefreshResult) {
  if (!fareSnapshot || fareSnapshot.status === "checked") return undefined;
  return fareSnapshot;
}

function uncheckedAirfare(
  destination: Destination,
  preferences: TripPreferences,
  tripWindow: TripWindow
): WatchRefreshResult {
  return {
    id: `${destination.slug}-unchecked`,
    destinationSlug: destination.slug,
    destinationName: destination.name,
    status: "skipped",
    message: `Airfare has not been checked for ${preferences.departure}, ${flightCountLabel(
      preferences.flightCount
    )}, and ${shortDate(
      tripWindow.departDate
    )}-${shortDate(tripWindow.returnDate)}.`,
    sourceUrl: googleFlightsSearchUrl({
      origin: preferences.departure,
      destination: destination.flightSearch.destination,
      destinationAirports: destination.flightSearch.destinationAirports,
      departDate: tripWindow.departDate,
      returnDate: tripWindow.returnDate,
      adults: preferences.flightCount
    }),
    sourceKind: "unavailable"
  };
}

function diningPrice(price: PriceRange, nights: number): PriceRange {
  if (price.max <= 0) return price;

  return {
    ...price,
    label: `${unitPriceLabel(price, "/day for two")} · ${moneyLabel(price.min * nights)}-${moneyLabel(
      price.max * nights
    )} for ${tripLengthLabel(nights)}`
  };
}

function lodgingStayLabel(result: WatchRefreshResult, nights: number) {
  if (!result.currentRange) return "Lodging unavailable";
  const nightlyMin = Math.round(result.currentRange.min / nights);
  const nightlyMax = Math.round(result.currentRange.max / nights);
  return `${rangeLabel(result.currentRange)} stay · ${rangeLabel({
    min: nightlyMin,
    max: nightlyMax
  })}/night`;
}

function lodgingCheckLabel(mode: LodgingMode, wasChecked: boolean) {
  if (wasChecked) return "Check again";
  if (mode.id === "hotel") return "Check hotel prices";
  if (mode.id === "group-house") return "Check house prices";
  return "Check apartment prices";
}

function guestLabel(count: number) {
  return `${count} ${count === 1 ? "guest" : "guests"}`;
}

function savedSearchDate(value: string) {
  return `${shortDate(value)}`;
}

function savedSearchTitle(search: SavedSearchSummary) {
  const dateText =
    search.departDate && search.returnDate
      ? `${savedSearchDate(search.departDate)}-${savedSearchDate(search.returnDate)}`
      : "saved dates";
  const nightsText = search.nights ? tripLengthLabel(search.nights) : "saved stay";
  const peopleText =
    search.kind === "airfare"
      ? flightCountLabel(search.flightCount ?? 1)
      : guestLabel(search.flightCount ?? 2);
  return `${dateText} · ${nightsText} · ${peopleText}`;
}

function lodgingPreferenceFromMode(modeId: LodgingModeId) {
  return lodgingModes[modeId].label;
}

function lodgingModeIdFromSaved(search: SavedSearchSummary): LodgingModeId | undefined {
  const lodging = search.lodging?.toLowerCase();
  if (!lodging) return undefined;
  if (lodging.includes("hotel")) return "hotel";
  if (lodging.includes("group") || lodging.includes("house")) return "group-house";
  if (lodging.includes("apartment")) return "apartment";
  return undefined;
}

const cardAirportOptions = [
  { code: "DEN", label: "Denver" },
  { code: "ABQ", label: "Albuquerque" },
  { code: "ATL", label: "Atlanta" },
  { code: "AUS", label: "Austin" },
  { code: "BNA", label: "Nashville" },
  { code: "BOS", label: "Boston" },
  { code: "BWI", label: "Baltimore" },
  { code: "DCA", label: "Washington Reagan" },
  { code: "DFW", label: "Dallas-Fort Worth" },
  { code: "JFK", label: "New York JFK" },
  { code: "LAX", label: "Los Angeles" },
  { code: "ORD", label: "Chicago O'Hare" },
  { code: "PHX", label: "Phoenix" },
  { code: "SEA", label: "Seattle" },
  { code: "SFO", label: "San Francisco" },
  { code: "SLC", label: "Salt Lake City" }
];

const cardNightOptions = [5, 7, 10, 14, 21, 28];

function normalizeCardNumber(value: number, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), min), max);
}

function sourceKindLabel(sourceKind: PriceRange["sourceKind"] | WatchRefreshResult["sourceKind"]) {
  if (sourceKind === "live") return "Live check";
  if (sourceKind === "cached") return "Saved check";
  if (sourceKind === "unavailable") return "Unavailable";
  return "Planning estimate";
}

function linkTone() {
  return "border-ink/12 bg-white text-ink/72 hover:border-harbor/45 hover:text-harbor";
}

function findTone(theme: Destination["visualTheme"]) {
  return theme.highlightClass;
}

function curatedFinds(destination: Destination) {
  if (destination.curatedFinds?.length) return destination.curatedFinds;
  if (!destination.retreatNote) return [];
  return [
    {
      label: "Retreat angle",
      note: destination.retreatNote,
      kind: "retreat" as const
    }
  ];
}

function transportAdvice(destination: Destination) {
  const modeAdvice: Record<Destination["transport"], string> = {
    "Train-first": "Prioritize lodging near the center or main station so trains remain the default.",
    "No car needed": "Choose central lodging; skip car logistics unless adding a rural or beach day.",
    "Car useful": "Use the car for day trips and landscape reach, not as the default city tool.",
    "Driver recommended": "Budget for transfers or guides; this looks more relaxed with local driving help.",
    "Avoid self-driving": "Use trains, taxis, ferries, or drivers instead of building the trip around a rental car."
  };
  const noteIsGeneric = /suggested destination|review local transport/i.test(destination.transportNote);

  return (
    <>
      <span className="block">
        {noteIsGeneric
          ? `Start by checking arrival transfers into ${destination.name}, then decide whether day trips need a driver or rental car.`
          : destination.transportNote}
      </span>
      <span className="mt-2 block text-ink/54">{modeAdvice[destination.transport]}</span>
    </>
  );
}

function lodgingFindNote(destination: Destination) {
  return destination.curatedFinds?.find((find) => find.kind === "lodging" || find.kind === "retreat")?.note;
}

function lodgingAnchor(destination: Destination) {
  if (destination.lodging.rental.max > 0) return destination.lodging.rental.label;
  return destination.tripType;
}

function longStayAdvice(destination: Destination) {
  const potentialAdvice: Record<Destination["monthlyPotential"], string> = {
    Excellent: "Strong candidate for a 3-4 week base if lodging prices cooperate.",
    Good: "Could work for a slower stay, but the exact neighborhood or base matters.",
    Selective: "Better as a longer stay only if this specific trip angle is the point.",
    Limited: "Treat as a shorter stay unless a very specific lodging setup makes it easy."
  };

  return (
    <>
      <span className="block">{potentialAdvice[destination.monthlyPotential]}</span>
      <span className="mt-2 block text-ink/54">Best months: {destination.bestMonths}.</span>
      <span className="mt-2 block text-ink/54">Anchor: {lodgingAnchor(destination)}</span>
      <span className="mt-2 block text-ink/54">Watch: {destination.avoid}</span>
    </>
  );
}

function groupRentalAdvice(destination: Destination) {
  const potentialAdvice: Record<Destination["sharedRentalPotential"], string> = {
    Excellent: "Actively worth checking apartments, cottages, riads, or houses for a shared stay.",
    Good: "Worth checking, especially if the stay is long enough to absorb fees and cleaning costs.",
    Possible: "Possible, but do not assume the group option will beat simple rooms without checking.",
    Limited: "Do not make this destination depend on finding a great shared rental."
  };
  const note = lodgingFindNote(destination);

  return (
    <>
      <span className="block">{potentialAdvice[destination.sharedRentalPotential]}</span>
      <span className="mt-2 block text-ink/54">Search angle: {lodgingAnchor(destination)}</span>
      {note ? <span className="mt-2 block text-ink/54">{note}</span> : null}
      {destination.lodging.rental.sourceDetail ? (
        <span className="mt-2 block text-ink/54">{destination.lodging.rental.sourceDetail}</span>
      ) : null}
    </>
  );
}

function InfoButton({
  label,
  children,
  tone = "default",
  highlightInfoClass = ""
}: {
  label: string;
  children: ReactNode;
  tone?: "default" | "onHighlight";
  highlightInfoClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonClass =
    tone === "onHighlight"
      ? `border-white/80 bg-white shadow-sm hover:border-white hover:bg-white/92 ${highlightInfoClass}`
      : "border-ink/15 bg-white text-ink/58 hover:border-harbor hover:text-harbor";

  return (
    <span
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex size-5 items-center justify-center rounded-full border transition ${buttonClass}`}
        aria-label={label}
        aria-expanded={open}
      >
        <Info size={12} aria-hidden="true" />
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent sm:hidden"
            aria-label="Close information"
            onClick={() => setOpen(false)}
          />
          <span
            role="tooltip"
            className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 max-h-[48vh] overflow-auto rounded-md border border-ink/12 !bg-white p-4 text-left text-sm font-normal leading-6 !text-ink shadow-soft [text-shadow:none] sm:absolute sm:bottom-auto sm:inset-x-auto sm:right-0 sm:top-7 sm:z-20 sm:max-h-none sm:w-72 sm:overflow-visible sm:p-3 sm:text-xs sm:leading-5"
          >
            {children}
          </span>
        </>
      ) : null}
    </span>
  );
}

function PhotoTools({
  destination,
  photoUrl,
  onPhotoChange
}: {
  destination: Destination;
  photoUrl: string;
  onPhotoChange: (photoUrl: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(photoUrl);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const sourceUrl = destination.visualTheme.photoSourceUrl ?? photoUrl;

  async function savePhoto() {
    const nextUrl = value.trim();
    if (!nextUrl) {
      setMessage("Paste an image URL first.");
      return;
    }

    setSaving(true);
    setMessage("Saving photo...");
    try {
      const response = await fetch("/api/destinations/photo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: destination.slug, photoUrl: nextUrl })
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string; photoUrl?: string };
      if (!response.ok || !data.photoUrl) throw new Error(data.message ?? "Unable to save photo.");
      onPhotoChange(data.photoUrl);
      setValue(data.photoUrl);
      setMessage(data.message ?? "Photo saved.");
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save photo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute right-4 top-4 z-10 text-shadow-none">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/35 bg-black/35 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/50"
        aria-expanded={open}
      >
        <ImageIcon size={14} aria-hidden="true" />
        Photo
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-[min(82vw,22rem)] rounded-md border border-ink/12 bg-white p-3 text-left text-xs leading-5 text-ink shadow-soft">
          <div className="flex flex-wrap gap-2">
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/12 bg-white px-2.5 py-1.5 font-semibold text-ink/64 transition hover:border-harbor/35 hover:text-harbor"
            >
              <ExternalLink size={12} aria-hidden="true" />
              View image
            </a>
            <a
              href={imageSearchUrl(destination)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/12 bg-white px-2.5 py-1.5 font-semibold text-ink/64 transition hover:border-harbor/35 hover:text-harbor"
            >
              <Search size={12} aria-hidden="true" />
              Search images
            </a>
          </div>
          <label className="mt-3 block">
            <span className="font-semibold uppercase tracking-wide text-ink/38">Image URL</span>
            <input
              className="mt-1 w-full rounded-md border border-ink/12 bg-white px-2.5 py-1.5 text-xs font-medium text-ink outline-none transition focus:border-harbor/45"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="https://..."
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-ink/42">
              Use a direct public image URL from the actual place.
            </span>
            <button
              type="button"
              onClick={() => void savePhoto()}
              disabled={saving}
              className="rounded-md border border-harbor/25 bg-harbor px-2.5 py-1.5 font-semibold text-white transition hover:bg-harbor/90 disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
          {message ? <span className="mt-2 block text-[11px] text-ink/48">{message}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function SourceInfo({ price, label }: { price: PriceRange; label: string }) {
  const detail =
    price.sourceDetail ??
    (label.toLowerCase().includes("dining")
      ? "Planning estimate only. Use it as a rough food budget placeholder, not a live restaurant-price check."
      : "Planning estimate only. Live or saved provider data has not been attached to this row.");

  return (
    <InfoButton label={`${label} source detail`}>
      <span className="block font-semibold text-ink">{label}</span>
      <span className="mt-1 block">{detail}</span>
      <span className="mt-2 block text-ink/38">
        Source: {price.provider} · {sourceKindLabel(price.sourceKind)} · {price.sampledDates} ·{" "}
        {price.retrievedAt ? `checked ${shortDate(price.retrievedAt)}` : "not checked"}
      </span>
    </InfoButton>
  );
}

function CheckButton({
  label,
  usage,
  onClick
}: {
  label: string;
  usage?: UsageState | null;
  onClick?: () => void;
}) {
  if (!onClick) return null;

  const capped = usage?.remaining === 0;

  return (
    <span className="inline-flex shrink-0 flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={onClick}
        disabled={capped}
        className="inline-flex items-center gap-1.5 rounded-md border border-ink/12 bg-white px-2 py-1 text-xs font-semibold text-ink/70 transition hover:border-harbor/35 hover:text-harbor disabled:cursor-not-allowed disabled:bg-ink/6 disabled:text-ink/30"
      >
        <RefreshCw size={12} aria-hidden="true" />
        {label}
      </button>
      {usage ? (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/34">
          {usage.remaining}/{usage.limit} left today
        </span>
      ) : null}
    </span>
  );
}

function CompactPriceLink({
  href,
  label,
  eyebrow,
  price,
  onCheckFare,
  usage,
  statusText
}: {
  href?: string;
  label: string;
  eyebrow: string;
  price: PriceRange;
  onCheckFare?: () => void;
  usage?: UsageState | null;
  statusText?: string;
}) {
  const sourceStatus =
    statusText ??
    (eyebrow === "Airfare"
      ? `${
          price.sourceKind === "live"
            ? "Checked"
            : price.sourceKind === "cached"
              ? "Saved from"
              : "Planning estimate from"
        } ${shortDate(price.retrievedAt)}`
      : "");

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-white/70">
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink/46">
          {eyebrow}
        </span>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-ink transition hover:text-harbor"
          >
            {label}
            <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
          </a>
        ) : (
          <span className="inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-ink">
            {label}
          </span>
        )}
        {sourceStatus ? (
          <span className="mt-0.5 block text-[11px] font-medium text-ink/42">{sourceStatus}</span>
        ) : null}
      </span>
      {eyebrow === "Airfare" ? (
        <CheckButton label="Check now" usage={usage} onClick={onCheckFare} />
      ) : null}
      <SourceInfo price={price} label={eyebrow} />
    </div>
  );
}

function UnavailablePriceLink({
  result,
  tripWindow,
  flightCount,
  onCheckFare,
  usage
}: {
  result: WatchRefreshResult;
  tripWindow: TripWindow;
  flightCount: number;
  onCheckFare?: () => void;
  usage?: UsageState | null;
}) {
  const wasChecked = Boolean(result.retrievedAt);
  const label = wasChecked ? "Airfare unavailable" : "Airfare not checked";

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-white/70">
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink/46">
          Airfare
        </span>
        {result.sourceUrl ? (
          <a
            href={result.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-ink transition hover:text-harbor"
          >
            {label}
            <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
          </a>
        ) : (
          <span className="inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-ink">
            {label}
          </span>
        )}
        <span className="mt-0.5 block text-[11px] font-medium text-ink/42">
          Travel dates {travelDateLabel(tripWindow)} · {flightCountLabel(flightCount)} ·{" "}
          {wasChecked ? `last checked ${shortDate(result.retrievedAt!)}` : "not checked yet"}
        </span>
        <span className="mt-0.5 block text-[11px] leading-4 text-clay">{result.message}</span>
      </span>
      <CheckButton label="Check now" usage={usage} onClick={onCheckFare} />
      <InfoButton label="Airfare unavailable detail">
        <span className="block font-semibold text-ink">{label}</span>
        <span className="mt-1 block">{result.message}</span>
        <span className="mt-2 block text-ink/38">
          Source: {result.provider ?? "Airfare check"} · unavailable ·{" "}
          {wasChecked ? `checked ${shortDate(result.retrievedAt!)}` : "not checked"}
        </span>
      </InfoButton>
    </div>
  );
}

function CheckingPriceLink({
  tripWindow,
  flightCount
}: {
  tripWindow: TripWindow;
  flightCount: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-white/70">
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink/46">
          Airfare
        </span>
        <span className="inline-flex max-w-full items-center gap-1.5 truncate text-sm font-semibold text-ink">
          <RefreshCw size={13} className="shrink-0 animate-spin text-harbor" aria-hidden="true" />
          Checking airfare...
        </span>
        <span className="mt-0.5 block text-[11px] font-medium text-ink/42">
          Travel dates {travelDateLabel(tripWindow)} · {flightCountLabel(flightCount)} · checking current prices
        </span>
      </span>
    </div>
  );
}

function ScenarioSummary({
  destination,
  preferences,
  lodgingMode,
  tripWindow,
  savedSearches,
  onScenarioChange
}: {
  destination: Destination;
  preferences: TripPreferences;
  lodgingMode: LodgingMode;
  tripWindow: TripWindow;
  savedSearches: SavedSearchSummary[];
  onScenarioChange?: (preferences: TripPreferences) => void;
}) {
  const [editing, setEditing] = useState(false);
  const destinationSearches = savedSearches
    .filter((search) => search.destinationSlug === destination.slug)
    .slice(0, 4);
  const seasonOptions = tripSeasonOptions(destination);
  const selectedSeason = preferences.departDate && preferences.returnDate
    ? "saved"
    : preferences.travelSeason ?? "recommended";
  const departureListId = `departure-airports-${destination.slug}`;

  function applyScenarioChanges(next: Partial<TripPreferences>) {
    onScenarioChange?.({
      ...preferences,
      ...next,
      departure: (next.departure ?? preferences.departure).trim().toUpperCase(),
      travelMode: next.travelMode === "drive" ? "drive" : next.travelMode === "fly" ? "fly" : preferences.travelMode
    });
  }

  function applyLodgingMode(modeId: LodgingModeId) {
    const mode = lodgingModes[modeId];
    onScenarioChange?.({
      ...preferences,
      lodging: lodgingPreferenceFromMode(modeId),
      flightCount: Math.max(preferences.flightCount, mode.adults)
    });
  }

  function applySavedSearch(search: SavedSearchSummary) {
    const savedModeId = lodgingModeIdFromSaved(search);
    const savedMode = savedModeId ? lodgingModes[savedModeId] : undefined;
    onScenarioChange?.({
      ...preferences,
      departure: search.departure ?? preferences.departure,
      flightCount: Math.max(
        search.flightCount ?? preferences.flightCount,
        savedMode?.adults ?? lodgingMode.adults
      ),
      nights: search.nights ?? preferences.nights,
      lodging: savedModeId ? lodgingPreferenceFromMode(savedModeId) : preferences.lodging,
      departDate: search.departDate,
      returnDate: search.returnDate,
      travelSeason: "saved"
    });
    setEditing(false);
  }

  return (
    <div className="mb-2 rounded-md border border-ink/10 bg-white/65 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink/38">
            Selected scenario
          </span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-ink/76">
            {preferences.travelMode === "drive"
              ? "Driving"
              : `${preferences.departure} · ${flightCountLabel(preferences.flightCount)}`}{" "}
            ·{" "}
            {travelDateLabel(tripWindow)} · {tripLengthLabel(preferences.nights)}
          </span>
        </span>
        {onScenarioChange ? (
          <button
            type="button"
            onClick={() => setEditing((open) => !open)}
            className="rounded-md border border-ink/12 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink/62 transition hover:border-harbor/35 hover:text-harbor"
            aria-expanded={editing}
          >
            {editing ? "Done" : "Edit"}
          </button>
        ) : null}
      </div>
      <label className="mt-2 grid gap-1 text-xs font-semibold text-ink/70 sm:max-w-64">
        <span className="text-[10px] uppercase tracking-wide text-ink/34">Selected lodging</span>
        <select
          value={lodgingMode.id}
          onChange={(event) => applyLodgingMode(event.target.value as LodgingModeId)}
          disabled={!onScenarioChange}
          className="h-9 rounded-md border border-ink/12 bg-white px-2 text-sm font-semibold text-ink outline-none transition focus:border-harbor/45 disabled:opacity-70"
        >
          {Object.values(lodgingModes).map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
      </label>
      <span className="mt-0.5 block text-[11px] leading-4 text-ink/42">
        These settings drive the summary cost and the price checks on this card.
      </span>
      {editing ? (
        <div className="mt-3 grid gap-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-md border border-ink/10 bg-white px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/34">
                Travel
              </span>
              <div className="mt-1 grid h-9 grid-cols-2 rounded-md border border-ink/12 bg-white p-0.5">
                {[
                  { value: "fly", label: "Fly", icon: Plane },
                  { value: "drive", label: "Drive", icon: Car }
                ].map((option) => {
                  const Icon = option.icon;
                  const active = (preferences.travelMode ?? "fly") === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        applyScenarioChanges({
                          travelMode: option.value as TripPreferences["travelMode"]
                        })
                      }
                      className={`inline-flex items-center justify-center gap-1 rounded-[4px] text-xs font-semibold transition ${
                        active
                          ? "bg-harbor text-white"
                          : "text-ink/58 hover:bg-ink/[0.04] hover:text-ink"
                      }`}
                      aria-pressed={active}
                    >
                      <Icon size={13} aria-hidden="true" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="grid gap-1 rounded-md border border-ink/10 bg-white px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/34">
                Departure
              </span>
              <input
                className="h-9 rounded-md border border-ink/12 bg-white px-2 text-sm font-semibold text-ink outline-none transition focus:border-harbor/45"
                list={departureListId}
                value={preferences.departure}
                onChange={(event) => applyScenarioChanges({ departure: event.target.value })}
              />
              <datalist id={departureListId}>
                {cardAirportOptions.map((airport) => (
                  <option
                    key={airport.code}
                    value={airport.code}
                    label={`${airport.code} · ${airport.label}`}
                  />
                ))}
              </datalist>
            </label>
            <label className="grid gap-1 rounded-md border border-ink/10 bg-white px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/34">
                Tickets
              </span>
              <input
                className="h-9 rounded-md border border-ink/12 bg-white px-2 text-sm font-semibold text-ink outline-none transition focus:border-harbor/45"
                type="number"
                min={1}
                max={8}
                value={preferences.flightCount}
                onChange={(event) =>
                  applyScenarioChanges({
                    flightCount: normalizeCardNumber(
                      Number(event.target.value),
                      preferences.flightCount,
                      1,
                      8
                    )
                  })
                }
              />
            </label>
            <label className="grid gap-1 rounded-md border border-ink/10 bg-white px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/34">
                Stay length
              </span>
              <select
                className="h-9 rounded-md border border-ink/12 bg-white px-2 text-sm font-semibold text-ink outline-none transition focus:border-harbor/45"
                value={cardNightOptions.includes(preferences.nights) ? String(preferences.nights) : "custom"}
                onChange={(event) => {
                  if (event.target.value === "custom") return;
                  applyScenarioChanges({
                    nights: normalizeCardNumber(Number(event.target.value), preferences.nights, 1, 60),
                    departDate: undefined,
                    returnDate: undefined,
                    travelSeason: selectedSeason === "saved" ? "recommended" : preferences.travelSeason
                  });
                }}
              >
                {cardNightOptions.map((nights) => (
                  <option key={nights} value={nights}>
                    {tripLengthLabel(nights)}
                  </option>
                ))}
                <option value="custom">custom</option>
              </select>
              {cardNightOptions.includes(preferences.nights) ? null : (
                <input
                  className="h-9 rounded-md border border-ink/12 bg-white px-2 text-sm font-semibold text-ink outline-none transition focus:border-harbor/45"
                  type="number"
                  min={1}
                  max={60}
                  value={preferences.nights}
                  onChange={(event) =>
                    applyScenarioChanges({
                      nights: normalizeCardNumber(Number(event.target.value), preferences.nights, 1, 60),
                      departDate: undefined,
                      returnDate: undefined,
                      travelSeason: selectedSeason === "saved" ? "recommended" : preferences.travelSeason
                    })
                  }
                />
              )}
            </label>
          </div>
          <div className="grid gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/34">
              Travel window
            </span>
            <div className="grid gap-2 sm:grid-cols-3">
              {seasonOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    applyScenarioChanges({
                      travelSeason: option.value,
                      departDate: undefined,
                      returnDate: undefined
                    })
                  }
                  className={`rounded-md border px-3 py-2 text-left transition ${
                    selectedSeason === option.value
                      ? "border-harbor/45 bg-harbor/8 text-ink"
                      : "border-ink/10 bg-white text-ink/62 hover:border-harbor/30 hover:text-ink"
                  }`}
                >
                  <span className="block text-xs font-semibold">{option.label}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-ink/42">
                    App-chosen dates inside {destination.bestMonths}
                  </span>
                </button>
              ))}
              {selectedSeason === "saved" ? (
                <span className="rounded-md border border-harbor/35 bg-harbor/8 px-3 py-2 text-left">
                  <span className="block text-xs font-semibold text-ink">Saved dates</span>
                  <span className="mt-1 block text-[11px] leading-4 text-ink/42">
                    {travelDateLabel(tripWindow)}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
          {destinationSearches.length ? (
            <div className="grid gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/34">
                Previous checks for this destination
              </span>
              <div className="grid gap-2 sm:grid-cols-2">
                {destinationSearches.map((search) => (
                  <button
                    key={search.id}
                    type="button"
                    onClick={() => applySavedSearch(search)}
                    className="rounded-md border border-ink/10 bg-white px-3 py-2 text-left transition hover:border-harbor/30 hover:text-harbor"
                  >
                    <span className="block text-xs font-semibold text-ink">
                      {search.kind === "airfare" ? "Airfare" : search.lodging ?? "Lodging"}
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-ink/48">
                      {savedSearchTitle(search)}
                    </span>
                    <span className="mt-1 block text-[10px] font-medium text-ink/34">
                      saved {shortDate(search.updatedAt)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LodgingPriceLink({
  result,
  mode,
  tripWindow,
  nights,
  onCheckLodging,
  usage
}: {
  result?: WatchRefreshResult;
  mode: LodgingMode;
  tripWindow: TripWindow;
  nights: number;
  onCheckLodging?: () => void;
  usage?: UsageState | null;
}) {
  const checkedAt = result?.retrievedAt;
  const wasChecked = Boolean(checkedAt);
  const checkedResult = result?.status === "checked" && result.currentRange ? result : undefined;
  const label = checkedResult ? lodgingStayLabel(checkedResult, nights) : `${mode.label} not checked`;
  const status = checkedResult
    ? `${checkedResult.sourceKind === "live" ? "checked" : "saved from"} ${shortDate(checkedAt!)}`
    : wasChecked
      ? `last checked ${shortDate(checkedAt!)}`
      : "not checked yet";
  const checkLabel = lodgingCheckLabel(mode, Boolean(checkedResult));

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-white/70">
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink/46">
          Selected lodging
        </span>
        {result?.sourceUrl ? (
          <a
            href={result.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-ink transition hover:text-harbor"
          >
            {label}
            <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
          </a>
        ) : (
          <span className="inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-ink">
            {label}
          </span>
        )}
        <span className="mt-0.5 block text-[11px] font-medium text-ink/42">
          {mode.label} · {travelDateLabel(tripWindow)} · {tripLengthLabel(nights)} ·{" "}
          {guestLabel(mode.adults)} · {status}
        </span>
        {result && result.status !== "checked" ? (
          <span className="mt-0.5 block text-[11px] leading-4 text-clay">{result.message}</span>
        ) : null}
      </span>
      <CheckButton label={checkLabel} usage={usage} onClick={onCheckLodging} />
      <InfoButton label={`${mode.label} lodging detail`}>
        <span className="block font-semibold text-ink">{mode.label}</span>
        <span className="mt-1 block">
          {result?.message ??
            "Lodging has not been checked for this stay type and date window yet."}
        </span>
        <span className="mt-2 block text-ink/38">
          Source: {result?.provider ?? "Lodging check"} · {sourceKindLabel(result?.sourceKind ?? "unavailable")} ·{" "}
          {result?.retrievedAt ? `checked ${shortDate(result.retrievedAt)}` : "not checked"}
        </span>
      </InfoButton>
    </div>
  );
}

function CheckingLodgingLink({ mode, tripWindow }: { mode: LodgingMode; tripWindow: TripWindow }) {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-white/70">
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink/46">
          Selected lodging
        </span>
        <span className="inline-flex max-w-full items-center gap-1.5 truncate text-sm font-semibold text-ink">
          <RefreshCw size={13} className="shrink-0 animate-spin text-harbor" aria-hidden="true" />
          Checking {mode.label.toLowerCase()}...
        </span>
        <span className="mt-0.5 block text-[11px] font-medium text-ink/42">
          Stay dates {travelDateLabel(tripWindow)} · checking current prices
        </span>
      </span>
    </div>
  );
}

export function DestinationCard({
  destination,
  fareSnapshot,
  lodgingMode,
  lodgingSnapshot,
  isCheckingFare = false,
  isCheckingLodging = false,
  onCheckFare,
  onCheckLodging,
  onScenarioChange,
  usage,
  preferences,
  tripWindow,
  savedSearches = [],
  isExpanded,
  onExpandedChange
}: {
  destination: Destination;
  fareSnapshot?: WatchRefreshResult;
  lodgingMode: LodgingMode;
  lodgingSnapshot?: WatchRefreshResult;
  isCheckingFare?: boolean;
  isCheckingLodging?: boolean;
  onCheckFare?: () => void;
  onCheckLodging?: () => void;
  onScenarioChange?: (preferences: TripPreferences) => void;
  usage?: UsageState | null;
  preferences: TripPreferences;
  tripWindow: TripWindow;
  savedSearches?: SavedSearchSummary[];
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const [pricesOpen, setPricesOpen] = useState(false);
  const theme = destination.visualTheme;
  const [photoUrl, setPhotoUrl] = useState(theme.photoUrl);
  const isDriving = preferences.travelMode === "drive";
  const airfare = isDriving
    ? undefined
    : snapshotAirfare(destination, fareSnapshot, preferences.flightCount);
  const unavailableFare =
    isDriving
      ? undefined
      : unavailableAirfare(fareSnapshot) ??
        (airfare ? undefined : uncheckedAirfare(destination, preferences, tripWindow));
  const diningTripPrice = diningPrice(destination.dining, preferences.nights);
  const airfareStatusText = airfare
    ? `Travel dates ${travelDateLabel(tripWindow)} · ${flightCountLabel(preferences.flightCount)} · ${
        airfare.sourceKind === "live"
          ? "checked"
          : airfare.sourceKind === "cached"
            ? "saved from"
            : "planning estimate from"
      } ${shortDate(airfare.retrievedAt)}`
    : undefined;
  const photoObjectPosition = theme.photoPosition ?? "center";
  const costSummary = tripCostSummary(
    destination,
    airfare,
    preferences.nights,
    preferences.travelMode,
    lodgingSnapshot,
    unavailableFare,
    isCheckingFare,
    isCheckingLodging
  );

  if (!isExpanded) {
    return (
      <article className={`mb-6 inline-block w-full break-inside-avoid overflow-hidden rounded-md border-2 bg-white ${theme.cardClass}`}>
        <div
          className={`relative min-h-[246px] w-full overflow-hidden text-left text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-harbor/45 ${theme.bannerClass}`}
        >
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt=""
              fill
              unoptimized
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
              style={{ objectPosition: photoObjectPosition }}
              aria-hidden="true"
            />
          ) : null}
          <span
            className={`absolute inset-0 bg-gradient-to-b mix-blend-multiply ${theme.heroOverlayClass}`}
            aria-hidden="true"
          />
          <span
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.64)_34%,rgba(0,0,0,0.32)_58%,rgba(0,0,0,0)_100%)]"
            aria-hidden="true"
          />
          <PhotoTools destination={destination} photoUrl={photoUrl} onPhotoChange={setPhotoUrl} />
          <div className="relative min-h-[246px] px-5 py-5 [text-shadow:_0_2px_5px_rgb(0_0_0_/_0.78),_0_1px_1px_rgb(0_0_0_/_0.95)]">
            <div className="min-w-0 pb-14">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/90 sm:text-sm">
                {destination.region} · {theme.moodLabel}
              </p>
              <h3 className="mt-2 text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
                <a
                  href={mapsUrl(destination)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 transition hover:text-white/78"
                >
                  {destination.name}
                  <MapPin size={28} className="shrink-0 sm:size-9" aria-hidden="true" />
                </a>
              </h3>
              <p className="mt-2 text-base font-semibold leading-5 text-white/94">
                {compactTripCostSummary(costSummary, preferences.nights, lodgingMode, preferences.travelMode)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onExpandedChange(true)}
              className={`absolute bottom-5 left-5 inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-white/22 ${theme.highlightClass} shadow-[0_8px_20px_rgb(0_0_0_/_0.24)] transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
              aria-expanded={false}
              aria-label={`Open ${destination.name} details`}
            >
              <ChevronDown size={22} strokeWidth={3} className="-rotate-90" aria-hidden="true" />
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={`mb-6 inline-block w-full break-inside-avoid overflow-visible rounded-md border-2 bg-white ${theme.cardClass}`}>
      <div
        className={`relative min-h-[246px] overflow-hidden text-white ${theme.bannerClass}`}
      >
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
            style={{ objectPosition: photoObjectPosition }}
            aria-hidden="true"
          />
        ) : null}
        <div
          className={`absolute inset-0 bg-gradient-to-b mix-blend-multiply ${theme.heroOverlayClass}`}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.62)_34%,rgba(0,0,0,0.3)_58%,rgba(0,0,0,0)_100%)]" />
        <PhotoTools destination={destination} photoUrl={photoUrl} onPhotoChange={setPhotoUrl} />
        <div className="relative min-h-[246px] px-5 py-5 [text-shadow:_0_2px_5px_rgb(0_0_0_/_0.78),_0_1px_1px_rgb(0_0_0_/_0.95)]">
          <div className="min-w-0 pb-14">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/90 sm:text-sm">
              {destination.region} · {theme.moodLabel}
            </p>
            <h3 className="mt-2 text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
              <a
                href={mapsUrl(destination)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 transition hover:text-white/78"
              >
                {destination.name}
                <MapPin size={28} className="shrink-0 sm:size-9" aria-hidden="true" />
              </a>
            </h3>
            <p className="mt-2 text-base font-semibold leading-5 text-white/94">
              {compactTripCostSummary(costSummary, preferences.nights, lodgingMode, preferences.travelMode)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onExpandedChange(false)}
            className={`absolute bottom-5 left-5 inline-flex size-10 items-center justify-center rounded-md border border-white/22 ${theme.highlightClass} shadow-[0_8px_20px_rgb(0_0_0_/_0.24)] transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
            aria-expanded={true}
            aria-label={`Collapse ${destination.name} details`}
          >
            <ChevronDown size={22} strokeWidth={3} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div>
        <div className={`border-b px-4 py-4 sm:px-5 ${theme.summaryClass}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{destination.tripType}</span>
          </div>

          <p className="mt-2 text-sm leading-6 text-ink/74">
            {destination.fitSummary}
          </p>

          <p className="mt-2 text-sm leading-6 text-ink/74">
            Best months: {destination.bestMonths}
          </p>

        </div>

        <div className="grid gap-3 px-4 py-4 sm:px-5">
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink/24">
              Cost details
            </p>
            <button
              type="button"
              onClick={() => setPricesOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/12 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-ink/78 transition hover:border-harbor/35 hover:text-harbor"
              aria-expanded={pricesOpen}
            >
              <span>Show breakdown</span>
              <ChevronDown
                size={14}
                className={`shrink-0 transition ${pricesOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            {pricesOpen ? (
              <div className={`mt-2 rounded-md border p-2 ${theme.panelClass}`}>
                <ScenarioSummary
                  destination={destination}
                  preferences={preferences}
                  lodgingMode={lodgingMode}
                  tripWindow={tripWindow}
                  savedSearches={savedSearches}
                  onScenarioChange={onScenarioChange}
                />
                {isDriving ? null : isCheckingFare ? (
                  <CheckingPriceLink
                    tripWindow={tripWindow}
                    flightCount={preferences.flightCount}
                  />
                ) : unavailableFare ? (
                  <UnavailablePriceLink
                    result={unavailableFare}
                    tripWindow={tripWindow}
                    flightCount={preferences.flightCount}
                    onCheckFare={onCheckFare}
                    usage={usage}
                  />
                ) : airfare ? (
                  <CompactPriceLink
                    href={airfare.sourceUrl}
                    label={airfare.label}
                    eyebrow="Airfare"
                    price={airfare}
                    onCheckFare={onCheckFare}
                    usage={usage}
                    statusText={airfareStatusText}
                  />
                ) : null}
                {isCheckingLodging ? (
                  <CheckingLodgingLink mode={lodgingMode} tripWindow={tripWindow} />
                ) : (
                  <LodgingPriceLink
                    result={lodgingSnapshot}
                    mode={lodgingMode}
                    tripWindow={tripWindow}
                    nights={preferences.nights}
                    onCheckLodging={onCheckLodging}
                    usage={usage}
                  />
                )}
                {diningTripPrice.sourceKind !== "unavailable" ? (
                  <CompactPriceLink
                    href={diningTripPrice.sourceUrl}
                    label={diningTripPrice.label}
                    eyebrow="Dining estimate"
                    price={diningTripPrice}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink/24">
              Practical fit
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-ink ring-1 ring-ink/10">
                {destination.transport}
                <InfoButton label={`${destination.transport} explanation`}>
                  {transportAdvice(destination)}
                </InfoButton>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/62">
                Long stay: {destination.monthlyPotential}
                <InfoButton label={`${destination.name} long stay potential`}>
                  {longStayAdvice(destination)}
                </InfoButton>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/62">
                Group rental: {destination.sharedRentalPotential}
                <InfoButton label={`${destination.name} group rental potential`}>
                  {groupRentalAdvice(destination)}
                </InfoButton>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-clay/20 bg-clay/5 px-2.5 py-1.5 text-xs font-medium text-ink/70">
                Trip tradeoff
                <InfoButton label={`${destination.name} trip tradeoff`}>
                  <span>{destination.caveat}</span>
                  <span className="mt-2 block text-ink/54">Watch: {destination.avoid}</span>
                </InfoButton>
              </span>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink/24">
              Scores
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-medium text-ink/62">
              {Object.entries(destination.fit).map(([key, value]) => (
                <ScoreRating
                  key={key}
                  label={key}
                  value={value}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink/24">
              Curated finds
            </p>
            <div className="flex flex-wrap gap-2">
              {curatedFinds(destination).map((find) => (
                <span
                  key={find.label}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold ${findTone(
                    theme
                  )}`}
                >
                  {find.url ? (
                    <a
                      href={find.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 transition hover:text-white/82"
                    >
                      {find.label}
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  ) : (
                    find.label
                  )}
                  <InfoButton
                    label={`${find.label} note`}
                    tone="onHighlight"
                    highlightInfoClass={theme.highlightInfoClass}
                  >
                    {find.note}
                  </InfoButton>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-4 mb-4 border-t border-ink/10 pt-3 sm:mx-5">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-ink/24">
            Research
          </p>
          <div className="flex flex-wrap gap-2">
            {destination.links
              .filter((link) => link.kind !== "airfare" && link.kind !== "lodging")
              .slice(0, 3)
              .map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${linkTone()}`}
                >
                  {link.label}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              ))}
          </div>
        </div>
      </div>
    </article>
  );
}
