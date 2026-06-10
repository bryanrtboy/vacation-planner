"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  MapPin,
} from "lucide-react";
import type { Destination, PriceRange, WatchedSearch } from "@/lib/types";

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

function linkTone() {
  return "border-ink/12 bg-white text-ink/72 hover:border-harbor/45 hover:text-harbor";
}

function findTone(kind: NonNullable<Destination["curatedFinds"]>[number]["kind"]) {
  switch (kind) {
    case "retreat":
    case "craft":
      return "border-moss/25 bg-moss/10 text-ink/78";
    case "art":
      return "border-harbor/25 bg-harbor/10 text-ink/78";
    default:
      return "border-moss/20 bg-moss/5 text-ink/72";
  }
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

function InfoButton({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex size-5 items-center justify-center rounded-full border border-ink/15 bg-white text-ink/58 transition hover:border-harbor hover:text-harbor"
        aria-label={label}
        aria-expanded={open}
      >
        <Info size={12} aria-hidden="true" />
      </button>
      {open ? (
        <span className="absolute right-0 top-7 z-20 w-72 rounded-md border border-ink/12 bg-white p-3 text-left text-xs leading-5 text-ink/72 shadow-soft">
          {children}
        </span>
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
      </span>
      <SourceInfo price={price} label={eyebrow} />
    </div>
  );
}

export function DestinationCard({ destination }: { destination: Destination }) {
  const [watched, setWatched] = useState(false);
  const [pricesOpen, setPricesOpen] = useState(false);
  const theme = destination.visualTheme;
  const bannerStyle = theme.photoUrl
    ? {
        backgroundImage: `${theme.photoOverlay}, url("${theme.photoUrl}")`,
        backgroundPosition: theme.photoPosition ?? "center"
      }
    : undefined;

  useEffect(() => {
    function sync() {
      setWatched(readWatches().some((watch) => watch.destinationSlug === destination.slug));
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
    <article className="overflow-visible rounded-md border border-ink/10 bg-white shadow-sm">
      <div
        className={`min-h-[76px] bg-cover px-5 py-4 text-white ${theme.bannerClass}`}
        style={bannerStyle}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/78">
              {destination.region} · {theme.moodLabel}
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-normal">
              <a
                href={mapsUrl(destination)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 transition hover:text-white/78"
              >
                {destination.name}
                <MapPin size={15} aria-hidden="true" />
              </a>
            </h3>
          </div>
          <button
            type="button"
            onClick={toggleWatch}
            className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${
              watched
                ? "border-white/30 bg-white text-ink"
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

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{destination.tripType}</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-ink/74">{destination.fitSummary}</p>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setPricesOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 rounded-md border border-ink/10 bg-ink/[0.035] px-3 py-2.5 text-left text-xs text-ink/62 transition hover:bg-ink/[0.055]"
            aria-expanded={pricesOpen}
          >
            <span className="grid min-w-0 gap-1 sm:grid-cols-[0.75fr_1.25fr] sm:items-center">
              <span>
                <span className="font-semibold text-ink/54">Best months</span>{" "}
                <span>{destination.bestMonths}</span>
              </span>
              <span>
                <span className="font-semibold text-ink/54">Cost snapshot</span>{" "}
                <span>air {destination.airfare.label}</span>
                <span className="mx-1 text-ink/30">·</span>
                <span>rental {destination.lodging.rental.label}</span>
              </span>
            </span>
            <ChevronDown
              size={15}
              className={`shrink-0 transition ${pricesOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {pricesOpen ? (
            <div className={`mt-2 rounded-md border p-2 ${theme.panelClass}`}>
              <CompactPriceLink
                href={destination.airfare.sourceUrl}
                label={destination.airfare.label}
                eyebrow="Airfare"
                price={destination.airfare}
              />
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
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3">
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
              <span className="rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-ink/64 ring-1 ring-ink/10">
                Monthly stay: {destination.monthlyPotential}
              </span>
              <span className="rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-ink/64 ring-1 ring-ink/10">
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
            <div className="flex flex-wrap gap-2">
              {Object.entries(destination.fit).map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 rounded-md bg-paper px-2.5 py-1 text-xs font-medium text-ink/64"
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
                    find.kind
                  )}`}
                >
                  {find.url ? (
                    <a
                      href={find.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 transition hover:text-harbor"
                    >
                      {find.label}
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  ) : (
                    find.label
                  )}
                  <InfoButton label={`${find.label} note`}>{find.note}</InfoButton>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-ink/10 pt-3">
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
