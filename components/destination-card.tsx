"use client";

import { type ReactNode, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  Info,
  MapPin,
  RefreshCw,
  Star,
} from "lucide-react";
import { googleFlightsSearchUrl } from "@/lib/flights/links";
import type { LodgingMode } from "@/lib/lodging/modes";
import { tripLengthLabel } from "@/lib/trip-preferences";
import type {
  Destination,
  PriceRange,
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

function bookingUrl(
  sourceUrl: string | undefined,
  tripWindow: TripWindow,
  options: { adults?: number; hotelClass?: number } = {}
) {
  if (!sourceUrl) return undefined;

  try {
    const url = new URL(sourceUrl);
    if (!url.hostname.includes("booking.com")) return sourceUrl;
    const adults = options.adults ?? 2;

    url.searchParams.set("checkin", tripWindow.departDate);
    url.searchParams.set("checkout", tripWindow.returnDate);
    url.searchParams.set("group_adults", String(adults));
    url.searchParams.set("no_rooms", "1");
    url.searchParams.set("group_children", "0");
    if (options.hotelClass) {
      url.searchParams.set("nflt", `class=${options.hotelClass}`);
    }
    return url.toString();
  } catch {
    return sourceUrl;
  }
}

function priceLabel(range: { min: number; max: number }, suffix: string) {
  return `$${range.min.toLocaleString()}-$${range.max.toLocaleString()} ${suffix}`;
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

function landCostEstimate(destination: Destination, nights: number) {
  const lodgingMidpoint =
    ((destination.lodging.rental.min + destination.lodging.rental.max) / 2) * nights;
  const diningMidpoint = ((destination.dining.min + destination.dining.max) / 2) * nights;
  return Math.round((lodgingMidpoint + diningMidpoint) / 50) * 50;
}

function tripCostEstimate(destination: Destination, airfare: PriceRange, nights: number) {
  const airfareMidpoint = (airfare.min + airfare.max) / 2;
  const roundedTotal =
    Math.round((airfareMidpoint + landCostEstimate(destination, nights)) / 50) * 50;

  return `$${roundedTotal.toLocaleString()}`;
}

function tripCostSummary(
  destination: Destination,
  airfare: PriceRange | undefined,
  nights: number,
  unavailable?: WatchRefreshResult,
  isCheckingFare?: boolean
) {
  if (isCheckingFare) {
    return `Land costs around $${landCostEstimate(destination, nights).toLocaleString()}; checking airfare.`;
  }

  if (!airfare || unavailable) {
    return `Land costs around $${landCostEstimate(destination, nights).toLocaleString()}; airfare not checked.`;
  }

  return `Cost around ${tripCostEstimate(destination, airfare, nights)}.`;
}

function rangeLabel(range: { min: number; max: number }) {
  return `$${range.min.toLocaleString()}-$${range.max.toLocaleString()}`;
}

function resultAirfare(destination: Destination, result: WatchRefreshResult): PriceRange {
  if (!result.currentRange) return destination.airfare;

  return {
    ...destination.airfare,
    min: result.currentRange.min,
    max: result.currentRange.max,
    label: priceLabel(result.currentRange, "round trip"),
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
  fareSnapshot?: WatchRefreshResult
): PriceRange | undefined {
  if (fareSnapshot?.status === "checked") return resultAirfare(destination, fareSnapshot);
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
    message: `Airfare has not been checked for ${preferences.departure} and ${shortDate(
      tripWindow.departDate
    )}-${shortDate(tripWindow.returnDate)}.`,
    sourceUrl: googleFlightsSearchUrl({
      origin: preferences.departure,
      destination: destination.flightSearch.destination,
      departDate: tripWindow.departDate,
      returnDate: tripWindow.returnDate
    }),
    sourceKind: "unavailable"
  };
}

function stayPrice(price: PriceRange, nights: number): PriceRange {
  return {
    ...price,
    label: `${unitPriceLabel(price, "/night")} · ${moneyLabel(price.min * nights)}-${moneyLabel(
      price.max * nights
    )} for ${tripLengthLabel(nights)}`
  };
}

function staySearchPrice(
  price: PriceRange,
  nights: number,
  tripWindow: TripWindow,
  options: { fallbackSourceUrl?: string; hotelClass?: number } = {}
): PriceRange {
  return {
    ...stayPrice(price, nights),
    sourceUrl: bookingUrl(price.sourceUrl ?? options.fallbackSourceUrl, tripWindow, {
      hotelClass: options.hotelClass
    })
  };
}

function diningPrice(price: PriceRange, nights: number): PriceRange {
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

function SourceInfo({ price, label }: { price: PriceRange; label: string }) {
  return (
    <InfoButton label={`${label} source detail`}>
      <span className="block font-semibold text-ink">{label}</span>
      <span className="mt-1 block">{price.sourceDetail}</span>
      <span className="mt-2 block text-ink/38">
        {price.provider} · {price.sourceKind} · sampled {price.sampledDates} · retrieved{" "}
        {price.retrievedAt}
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
      ? `${price.sourceKind === "live" ? "Live" : price.sourceKind === "cached" ? "Cached" : "Mock"} ${
          price.sourceKind === "live" ? "checked" : "from"
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
  onCheckFare,
  usage
}: {
  result: WatchRefreshResult;
  tripWindow: TripWindow;
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
          Travel dates {travelDateLabel(tripWindow)} ·{" "}
          {wasChecked ? `last checked ${shortDate(result.retrievedAt!)}` : "not checked yet"}
        </span>
        <span className="mt-0.5 block text-[11px] leading-4 text-clay">{result.message}</span>
      </span>
      <CheckButton label="Check now" usage={usage} onClick={onCheckFare} />
      <InfoButton label="Airfare unavailable detail">
        <span className="block font-semibold text-ink">{label}</span>
        <span className="mt-1 block">{result.message}</span>
        <span className="mt-2 block text-ink/38">
          {result.provider ?? "Live airfare provider"} · unavailable ·{" "}
          {wasChecked ? `checked ${shortDate(result.retrievedAt!)}` : "not checked"}
        </span>
      </InfoButton>
    </div>
  );
}

function CheckingPriceLink({ tripWindow }: { tripWindow: TripWindow }) {
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
          Travel dates {travelDateLabel(tripWindow)} · querying live provider
        </span>
      </span>
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
  const isChecked = result?.status === "checked" && result.currentRange;
  const label = isChecked ? lodgingStayLabel(result, nights) : "Lodging not checked";
  const status = isChecked
    ? `${result.sourceKind === "live" ? "live checked" : "cached from"} ${shortDate(checkedAt!)}`
    : wasChecked
      ? `last checked ${shortDate(checkedAt!)}`
      : "not checked yet";

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-white/70">
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink/46">
          Lodging: {mode.label}
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
          Stay dates {travelDateLabel(tripWindow)} · {status}
        </span>
        {result && result.status !== "checked" ? (
          <span className="mt-0.5 block text-[11px] leading-4 text-clay">{result.message}</span>
        ) : null}
      </span>
      <CheckButton label="Check lodging" usage={usage} onClick={onCheckLodging} />
      <InfoButton label={`${mode.label} lodging detail`}>
        <span className="block font-semibold text-ink">{mode.label}</span>
        <span className="mt-1 block">
          {result?.message ??
            "Live lodging has not been checked for this mode and date window yet."}
        </span>
        <span className="mt-2 block text-ink/38">
          {result?.provider ?? "SerpApi Google Hotels"} · {result?.sourceKind ?? "unavailable"} ·{" "}
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
          Lodging: {mode.label}
        </span>
        <span className="inline-flex max-w-full items-center gap-1.5 truncate text-sm font-semibold text-ink">
          <RefreshCw size={13} className="shrink-0 animate-spin text-harbor" aria-hidden="true" />
          Checking lodging...
        </span>
        <span className="mt-0.5 block text-[11px] font-medium text-ink/42">
          Stay dates {travelDateLabel(tripWindow)} · querying live provider
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
  usage,
  preferences,
  tripWindow
}: {
  destination: Destination;
  fareSnapshot?: WatchRefreshResult;
  lodgingMode: LodgingMode;
  lodgingSnapshot?: WatchRefreshResult;
  isCheckingFare?: boolean;
  isCheckingLodging?: boolean;
  onCheckFare?: () => void;
  onCheckLodging?: () => void;
  usage?: UsageState | null;
  preferences: TripPreferences;
  tripWindow: TripWindow;
}) {
  const [pricesOpen, setPricesOpen] = useState(false);
  const theme = destination.visualTheme;
  const airfare = snapshotAirfare(destination, fareSnapshot);
  const unavailableFare =
    unavailableAirfare(fareSnapshot) ?? (airfare ? undefined : uncheckedAirfare(destination, preferences, tripWindow));
  const rentalPrice = staySearchPrice(destination.lodging.rental, preferences.nights, tripWindow);
  const hotel3StarPrice = staySearchPrice(
    destination.lodging.hotel3Star,
    preferences.nights,
    tripWindow,
    {
      fallbackSourceUrl: destination.lodging.rental.sourceUrl,
      hotelClass: 3
    }
  );
  const diningTripPrice = diningPrice(destination.dining, preferences.nights);
  const airfareStatusText = airfare
    ? `Travel dates ${travelDateLabel(tripWindow)} · ${
        airfare.sourceKind === "live" ? "live checked" : airfare.sourceKind === "cached" ? "cached from" : "mock from"
      } ${shortDate(airfare.retrievedAt)}`
    : undefined;
  const bannerStyle = theme.photoUrl
    ? {
        backgroundImage: `${theme.photoOverlay}, url("${theme.photoUrl}")`,
        backgroundPosition: theme.photoPosition ?? "center"
      }
    : undefined;

  return (
    <article className={`overflow-visible rounded-md border-2 bg-white ${theme.cardClass}`}>
      <div
        className={`relative min-h-[224px] bg-cover text-white ${theme.bannerClass}`}
        style={bannerStyle}
      >
        <div
          className={`absolute inset-0 bg-gradient-to-b mix-blend-multiply ${theme.heroOverlayClass}`}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/14 to-transparent" />
        <div className="relative px-5 py-5 [text-shadow:_0_2px_5px_rgb(0_0_0_/_0.72),_0_1px_1px_rgb(0_0_0_/_0.9)]">
          <div className="min-w-0">
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
          </div>
        </div>
      </div>

      <div>
        <div className={`border-b px-4 py-4 sm:px-5 ${theme.summaryClass}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{destination.tripType}</span>
          </div>

          <p className="mt-2 text-sm leading-6 text-ink/74">
            {destination.fitSummary}{" "}
            <span className="font-semibold text-ink">
              {tripCostSummary(
                destination,
                airfare,
                preferences.nights,
                unavailableFare,
                isCheckingFare
              )}
            </span>
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
                {isCheckingFare ? (
                  <CheckingPriceLink tripWindow={tripWindow} />
                ) : unavailableFare ? (
                  <UnavailablePriceLink
                    result={unavailableFare}
                    tripWindow={tripWindow}
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
                <CompactPriceLink
                  href={rentalPrice.sourceUrl}
                  label={rentalPrice.label}
                  eyebrow="Rental"
                  price={rentalPrice}
                />
                <CompactPriceLink
                  href={hotel3StarPrice.sourceUrl}
                  label={hotel3StarPrice.label}
                  eyebrow="3-star baseline"
                  price={hotel3StarPrice}
                />
                <CompactPriceLink
                  href={diningTripPrice.sourceUrl}
                  label={diningTripPrice.label}
                  eyebrow="Dining"
                  price={diningTripPrice}
                />
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
                  {destination.transportNote}
                </InfoButton>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/62">
                Long stay: {destination.monthlyPotential}
                <InfoButton label={`${destination.name} long stay potential`}>
                  How well this works as a slower 3-4 week base, not just a short visit.
                </InfoButton>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/62">
                Group rental: {destination.sharedRentalPotential}
                <InfoButton label={`${destination.name} group rental potential`}>
                  How plausible this looks for an apartment, cottage, or shared house stay.
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
