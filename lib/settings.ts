export const SERPAPI_DAILY_CAP = Number(
  process.env.SERPAPI_DAILY_CAP ?? process.env.WATCH_DAILY_CAP ?? 25
);

export const defaultPreferences = {
  homeAirport: "DEN",
  preferredAirline: "United / Star Alliance preferred, all airlines searched",
  tripLength: "7 nights",
  lodging:
    "Apartments, villas, chateaux, riads, artist guesthouses, and unusual longer-stay rentals",
  style: "Art, food, gardens, landscape, architecture, quiet bases, trains, slow travel"
};
