import type { Destination, TripWindow } from "@/lib/types";
import type { LodgingMode } from "@/lib/lodging/modes";
import { lodgingSearchQuery } from "@/lib/lodging/modes";

export function googleHotelsSearchUrl(
  destination: Destination,
  tripWindow: TripWindow,
  mode: LodgingMode
) {
  const query = `${lodgingSearchQuery(destination, mode)} ${tripWindow.departDate} ${tripWindow.returnDate}`;
  return `https://www.google.com/travel/hotels?q=${encodeURIComponent(query)}`;
}
