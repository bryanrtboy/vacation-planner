import type { Destination } from "@/lib/types";

type FlightSearchLink = Pick<Destination["flightSearch"], "origin" | "destination" | "departDate" | "returnDate">;

export function googleFlightsSearchUrl(search: FlightSearchLink) {
  const query = `${search.origin} to ${search.destination} ${search.departDate} ${search.returnDate} round trip`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}
