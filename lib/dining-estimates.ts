import type { Destination, PriceRange } from "@/lib/types";

const retrievedAt = "2026-06-11";

type DiningBand = {
  min: number;
  max: number;
  label: string;
};

const defaultDiningBand: DiningBand = {
  min: 80,
  max: 170,
  label: "general international city"
};

function textForDestination(destination: Pick<Destination, "name" | "region" | "tripType" | "highlights">) {
  return [destination.name, destination.region, destination.tripType, destination.highlights.join(" ")]
    .join(" ")
    .toLowerCase();
}

function regionalDiningBand(destination: Pick<Destination, "name" | "region" | "tripType" | "highlights">): DiningBand {
  const text = textForDestination(destination);

  if (/(mexico|oaxaca|san miguel|guanajuato|puebla|queretaro)/.test(text)) {
    return { min: 70, max: 130, label: "Mexico planning" };
  }

  if (/(japan|tokyo|kyoto|osaka|kanazawa|fukuoka|sapporo)/.test(text)) {
    return { min: 80, max: 150, label: "Japan planning" };
  }

  if (/(morocco|essaouira|marrakech|fes|rabat|tangier|north africa)/.test(text)) {
    return { min: 65, max: 125, label: "Morocco and North Africa planning" };
  }

  if (/(thailand|vietnam|cambodia|laos|malaysia|indonesia|philippines|southeast asia)/.test(text)) {
    return { min: 55, max: 115, label: "Southeast Asia planning" };
  }

  if (/(portugal|spain|valencia|girona|andalusia|greece|southern europe)/.test(text)) {
    return { min: 95, max: 175, label: "Southern Europe planning" };
  }

  if (/(italy|france|provence|avignon|bordeaux|burgundy|tuscany|wine country|vineyard|wine)/.test(text)) {
    return { min: 115, max: 215, label: "Western Europe wine-region planning" };
  }

  if (/(austria|germany|netherlands|belgium|ireland|united kingdom|england|scotland)/.test(text)) {
    return { min: 115, max: 220, label: "Western Europe planning" };
  }

  if (/(switzerland|norway|sweden|denmark|finland|iceland|nordic)/.test(text)) {
    return { min: 145, max: 275, label: "high-cost Europe planning" };
  }

  if (/(slovenia|croatia|czech|poland|hungary|romania|balkans|eastern europe)/.test(text)) {
    return { min: 80, max: 155, label: "Central and Eastern Europe planning" };
  }

  if (/(united states|usa|california|napa|sonoma|new york|san francisco|canada|british columbia)/.test(text)) {
    return { min: 130, max: 245, label: "U.S. and Canada planning" };
  }

  return defaultDiningBand;
}

export function fallbackDiningEstimate(destination: Destination): PriceRange {
  const band = regionalDiningBand(destination);

  return {
    min: band.min,
    max: band.max,
    currency: "USD",
    label: `$${band.min}-$${band.max}/day for two`,
    provider: "Regional dining fallback",
    sampledDates: `${band.label} estimate`,
    retrievedAt,
    sourceDetail:
      "Fallback daily dining budget for two based on broad regional travel-cost patterns and government per-diem-style meal budgeting. Use it for comparison only; it is not a live menu-price check.",
    sourceKind: "mock"
  };
}

export function withDiningFallback(destination: Destination): Destination {
  if (destination.dining.max > 0) return destination;

  return {
    ...destination,
    dining: fallbackDiningEstimate(destination)
  };
}
