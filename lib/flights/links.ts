import type { Destination } from "@/lib/types";

type FlightSearchLink = Pick<
  Destination["flightSearch"],
  "origin" | "destination" | "departDate" | "returnDate" | "destinationAirports"
> & {
  adults?: number;
};

function routeCode(value: string) {
  return encodeURIComponent(value.trim().toUpperCase());
}

function arrivalCode(search: FlightSearchLink) {
  return (
    search.destinationAirports?.find((airport) => /^[A-Z]{3}$/.test(airport)) ??
    search.destination
  );
}

export function googleFlightsSearchUrl(search: FlightSearchLink) {
  const origin = routeCode(search.origin);
  const arrival = routeCode(arrivalCode(search));
  const adults = Math.max(Math.round(search.adults ?? 1), 1);
  const route = `${origin}.${arrival}.${search.departDate}*${arrival}.${origin}.${search.returnDate}`;

  return `https://www.google.com/travel/flights#flt=${route};c:USD;e:1;px:${adults};sd:1;t:f`;
}
