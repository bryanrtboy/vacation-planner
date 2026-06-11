import type { Destination, TripPreferences, TripWindow } from "@/lib/types";

export type LodgingModeId = "hotel" | "apartment" | "group-house";

export type LodgingMode = {
  id: LodgingModeId;
  label: string;
  adults: number;
  vacationRental: boolean;
  querySuffix: string;
};

export const lodgingModes: Record<LodgingModeId, LodgingMode> = {
  hotel: {
    id: "hotel",
    label: "Hotel room",
    adults: 2,
    vacationRental: false,
    querySuffix: "hotels"
  },
  apartment: {
    id: "apartment",
    label: "Apartment for 2",
    adults: 2,
    vacationRental: true,
    querySuffix: "apartment vacation rental"
  },
  "group-house": {
    id: "group-house",
    label: "Group house rental",
    adults: 4,
    vacationRental: true,
    querySuffix: "house vacation rental"
  }
};

export function lodgingModeFromPreference(preference: TripPreferences["lodging"]): LodgingMode {
  const normalized = preference.toLowerCase();
  if (normalized.includes("hotel")) return lodgingModes.hotel;
  if (normalized.includes("group") || normalized.includes("house")) return lodgingModes["group-house"];
  return lodgingModes.apartment;
}

export function lodgingSearchQuery(destination: Destination, mode: LodgingMode) {
  return `${destination.mapQuery} ${mode.querySuffix}`;
}

export function lodgingSnapshotKey(
  destination: Destination,
  tripWindow: TripWindow,
  mode: LodgingMode
) {
  return `${destination.slug}:${mode.id}:${tripWindow.departDate}:${tripWindow.returnDate}:${mode.adults}`;
}
