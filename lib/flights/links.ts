import type { Destination } from "@/lib/types";

type FlightSearchLink = Pick<
  Destination["flightSearch"],
  "origin" | "destination" | "departDate" | "returnDate" | "destinationAirports"
> & {
  adults?: number;
};

function arrivalCode(search: FlightSearchLink) {
  return (
    search.destinationAirports?.find((airport) => /^[A-Z]{3}$/.test(airport)) ??
    search.destination
  );
}

export function googleFlightsSearchUrl(search: FlightSearchLink) {
  const origin = search.origin.trim().toUpperCase();
  const arrival = arrivalCode(search).trim().toUpperCase();
  const adults = Math.max(Math.round(search.adults ?? 1), 1);
  const query = [
    "round trip flights",
    `from ${origin}`,
    `to ${arrival}`,
    `departing ${search.departDate}`,
    `returning ${search.returnDate}`,
    `for ${adults} ${adults === 1 ? "adult" : "adults"}`
  ].join(" ");

  return `https://www.google.com/travel/flights?gl=us&hl=en&curr=USD&q=${encodeURIComponent(query)}`;
}
