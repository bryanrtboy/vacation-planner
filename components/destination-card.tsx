"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  MapPin,
  RefreshCw,
} from "lucide-react";
import type { Destination, PriceRange, WatchedSearch, WatchRefreshResult } from "@/lib/types";

const storageKey = "artist-travel-finder:watches";

function readWatches(): WatchedSearch[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WatchedSearch[];
  } catch {
    return [];
  }
}

function writeWatches(watches: WatchedSearch[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(watches));
  window.dispatchEvent(new CustomEvent("artist-travel-finder:watches-changed"));
}

function scoreLabel(label: string) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function mapsUrl(destination: Destination) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    destination.mapQuery
  )}`;
}

function priceLabel(range: { min: number; max: number }, suffix: string) {
  return `$${range.min.toLocaleString()}-$${range.max.toLocaleString()} ${suffix}`;
}

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function landCostEstimate(destination: Destination) {
  const nights = 7;
  const lodgingMidpoint =
    ((destination.lodging.rental.min + destination.lodging.rental.max) / 2) * nights;
  const diningMidpoint = ((destination.dining.min + destination.dining.max) / 2) * nights;
  return Math.round((lodgingMidpoint + diningMidpoint) / 50) * 50;
}

function tripCostEstimate(destination: Destination, airfare: PriceRange) {
  const airfareMidpoint = (airfare.min + airfare.max) / 2;
  const roundedTotal = Math.round((airfareMidpoint + landCostEstimate(destination)) / 50) * 50;

  return `$${roundedTotal.toLocaleString()}`;
}

function tripCostSummary(
  destination: Destination,
  airfare: PriceRange,
  unavailable?: WatchRefreshResult,
  isCheckingFare?: boolean
) {
  if (isCheckingFare && !unavailable) {
    return `Land costs around $${landCostEstimate(destination).toLocaleString()}; checking airfare.`;
  }

  if (unavailable) {
    return `Land costs around $${landCostEstimate(destination).toLocaleString()}; airfare unavailable.`;
  }

  return `Cost around ${tripCostEstimate(destination, airfare)}.`;
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

function watchedAirfare(
  destination: Destination,
  watch?: WatchedSearch,
  fareSnapshot?: WatchRefreshResult
): PriceRange {
  if (watch?.lastRange) {
    return {
      ...destination.airfare,
      min: watch.lastRange.min,
      max: watch.lastRange.max,
      label: priceLabel(watch.lastRange, "round trip"),
      provider: watch.lastProvider ?? destination.airfare.provider,
      sampledDates: watch.lastSampledDates ?? destination.airfare.sampledDates,
      retrievedAt: watch.lastCheckedAt ?? destination.airfare.retrievedAt,
      sourceUrl: watch.lastSourceUrl ?? destination.airfare.sourceUrl,
      sourceDetail: watch.lastSourceDetail ?? destination.airfare.sourceDetail,
      sourceKind: watch.lastSourceKind ?? destination.airfare.sourceKind
    };
  }

  if (fareSnapshot?.status === "checked") return resultAirfare(destination, fareSnapshot);
  return destination.airfare;
}

function unavailableAirfare(fareSnapshot?: WatchRefreshResult) {
  if (!fareSnapshot || fareSnapshot.status === "checked") return undefined;
  return fareSnapshot;
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

function CompactPriceLink({
  href,
  label,
  eyebrow,
  price
}: {
  href?: string;
  label: string;
  eyebrow: string;
  price: PriceRange;
}) {
  const sourceStatus =
    eyebrow === "Airfare"
      ? `${price.sourceKind === "live" ? "Live" : price.sourceKind === "cached" ? "Cached" : "Mock"} ${
          price.sourceKind === "live" ? "checked" : "from"
        } ${shortDate(price.retrievedAt)}`
      : "";

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
      <SourceInfo price={price} label={eyebrow} />
    </div>
  );
}

function UnavailablePriceLink({
  result,
  onCheckFare
}: {
  result: WatchRefreshResult;
  onCheckFare?: () => void;
}) {
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
            Airfare unavailable
            <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
          </a>
        ) : (
          <span className="inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-ink">
            Airfare unavailable
          </span>
        )}
        <span className="mt-0.5 block text-[11px] font-medium text-ink/42">
          Last checked {result.retrievedAt ? shortDate(result.retrievedAt) : "recently"}
        </span>
      </span>
      {onCheckFare ? (
        <button
          type="button"
          onClick={onCheckFare}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ink/12 bg-white px-2 py-1 text-xs font-semibold text-ink/70 transition hover:border-harbor/35 hover:text-harbor"
        >
          <RefreshCw size={12} aria-hidden="true" />
          Check now
        </button>
      ) : null}
      <InfoButton label="Airfare unavailable detail">
        <span className="block font-semibold text-ink">Airfare unavailable</span>
        <span className="mt-1 block">{result.message}</span>
        <span className="mt-2 block text-ink/38">
          {result.provider ?? "Live airfare provider"} · unavailable · checked{" "}
          {result.retrievedAt ? shortDate(result.retrievedAt) : "recently"}
        </span>
      </InfoButton>
    </div>
  );
}

function CheckingPriceLink() {
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
          Querying live provider
        </span>
      </span>
    </div>
  );
}

export function DestinationCard({
  destination,
  fareSnapshot,
  isCheckingFare = false,
  onCheckFare
}: {
  destination: Destination;
  fareSnapshot?: WatchRefreshResult;
  isCheckingFare?: boolean;
  onCheckFare?: () => void;
}) {
  const [watched, setWatched] = useState(false);
  const [watch, setWatch] = useState<WatchedSearch | undefined>();
  const [pricesOpen, setPricesOpen] = useState(false);
  const theme = destination.visualTheme;
  const airfare = watchedAirfare(destination, watch, fareSnapshot);
  const unavailableFare = unavailableAirfare(fareSnapshot);
  const bannerStyle = theme.photoUrl
    ? {
        backgroundImage: `${theme.photoOverlay}, url("${theme.photoUrl}")`,
        backgroundPosition: theme.photoPosition ?? "center"
      }
    : undefined;

  useEffect(() => {
    function sync() {
      const currentWatch = readWatches().find((item) => item.destinationSlug === destination.slug);
      setWatch(currentWatch);
      setWatched(Boolean(currentWatch));
    }

    sync();
    window.addEventListener("artist-travel-finder:watches-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("artist-travel-finder:watches-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [destination.slug]);

  function toggleWatch() {
    const watches = readWatches();
    if (watched) {
      writeWatches(watches.filter((watch) => watch.destinationSlug !== destination.slug));
      return;
    }

    writeWatches([
      ...watches,
      {
        id: `${destination.slug}-spring-7`,
        destinationSlug: destination.slug,
        destinationName: destination.name,
        route: `${destination.flightSearch.origin} to ${destination.flightSearch.destination}`,
        season: destination.bestMonths,
        tripLength: "7-nights",
        lastRange: {
          min: destination.airfare.min,
          max: destination.airfare.max
        }
      }
    ]);
  }

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
        <div className="relative flex items-start justify-between gap-4 px-5 py-5 [text-shadow:_0_2px_5px_rgb(0_0_0_/_0.72),_0_1px_1px_rgb(0_0_0_/_0.9)]">
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
          <button
            type="button"
            onClick={toggleWatch}
            className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold shadow-[0_1px_8px_rgb(0_0_0_/_0.22)] transition ${
              watched
                ? theme.watchActiveClass
                : "border-white/30 bg-white/12 text-white hover:bg-white/22"
            }`}
            title={watched ? "Remove from price watch" : "Add to price watch"}
          >
            {watched ? (
              <EyeOff size={16} aria-hidden="true" />
            ) : (
              <Eye size={16} aria-hidden="true" />
            )}
            <span>{watched ? "Watching" : "Watch"}</span>
          </button>
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
              {tripCostSummary(destination, airfare, unavailableFare, isCheckingFare)}
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
                  <CheckingPriceLink />
                ) : unavailableFare ? (
                  <UnavailablePriceLink result={unavailableFare} onCheckFare={onCheckFare} />
                ) : (
                  <CompactPriceLink
                    href={airfare.sourceUrl}
                    label={airfare.label}
                    eyebrow="Airfare"
                    price={airfare}
                  />
                )}
                <CompactPriceLink
                  href={destination.lodging.rental.sourceUrl}
                  label={destination.lodging.rental.label}
                  eyebrow="Rental"
                  price={destination.lodging.rental}
                />
                <CompactPriceLink
                  href={destination.lodging.hotel3Star.sourceUrl}
                  label={destination.lodging.hotel3Star.label}
                  eyebrow="3-star baseline"
                  price={destination.lodging.hotel3Star}
                />
                <CompactPriceLink
                  href={destination.dining.sourceUrl}
                  label={destination.dining.label}
                  eyebrow="Dining"
                  price={destination.dining}
                />
              </div>
            ) : null}
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink/24">
              Logistics
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-ink ring-1 ring-ink/10">
                {destination.transport}
                <InfoButton label={`${destination.transport} explanation`}>
                  {destination.transportNote}
                </InfoButton>
              </span>
              <span className="text-xs font-medium text-ink/62">
                Monthly stay: {destination.monthlyPotential}
              </span>
              <span className="text-xs font-medium text-ink/62">
                Shared rental: {destination.sharedRentalPotential}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-clay/20 bg-clay/5 px-2.5 py-1.5 text-xs font-medium text-ink/70">
                Crowd note
                <InfoButton label={`${destination.name} caveat`}>
                  <span>{destination.caveat}</span>
                  <span className="mt-2 block text-ink/54">Avoid: {destination.avoid}</span>
                </InfoButton>
              </span>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink/24">
              Scores
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-ink/62">
              {Object.entries(destination.fit).map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1"
                >
                  {scoreLabel(key)} {value}/10
                </span>
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
