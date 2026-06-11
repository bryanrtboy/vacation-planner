import type { Destination } from "@/lib/types";

export function googleFlightsSearchUrl(search: Destination["flightSearch"]) {
  const query = `${search.origin} to ${search.destination} ${search.departDate} ${search.returnDate} round trip`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}
