import type { Destination } from "@/lib/types";

type FlightSearchLink = Pick<
  Destination["flightSearch"],
  "origin" | "destination" | "departDate" | "returnDate"
> & {
  adults?: number;
};

export function googleFlightsSearchUrl(search: FlightSearchLink) {
  const travelers =
    search.adults && search.adults > 1
      ? ` ${search.adults} adults`
      : "";
  const query = `${search.origin} to ${search.destination} ${search.departDate} ${search.returnDate} round trip${travelers}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}
