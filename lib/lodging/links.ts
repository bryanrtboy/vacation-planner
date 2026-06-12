import type { Destination, TripWindow } from "@/lib/types";
import type { LodgingMode } from "@/lib/lodging/modes";
import { lodgingSearchQuery } from "@/lib/lodging/modes";

export function googleHotelsSearchUrl(
  destination: Destination,
  tripWindow: TripWindow,
  mode: LodgingMode
) {
  const params = new URLSearchParams({
    q: lodgingSearchQuery(destination, mode),
    checkin: tripWindow.departDate,
    checkout: tripWindow.returnDate,
    adults: String(mode.adults),
    children: "0",
    currency: "USD"
  });

  if (mode.vacationRental) {
    params.set("vacation_rentals", "true");
  }

  return `https://www.google.com/travel/search?${params.toString()}`;
}

export function lodgingInspectUrl(
  destination: Destination,
  tripWindow: TripWindow,
  mode: LodgingMode
) {
  const params = new URLSearchParams({
    slug: destination.slug,
    mode: mode.id,
    departDate: tripWindow.departDate,
    returnDate: tripWindow.returnDate
  });

  return `/api/lodging/inspect?${params.toString()}`;
}
