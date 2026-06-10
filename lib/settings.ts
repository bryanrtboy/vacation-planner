export const WATCH_REFRESH_STALE_HOURS = Number(process.env.WATCH_REFRESH_STALE_HOURS ?? 24);
export const WATCH_DAILY_CAP = Number(process.env.WATCH_DAILY_CAP ?? 25);
export const WATCH_MAX_DESTINATIONS = Number(process.env.WATCH_MAX_DESTINATIONS ?? 20);

export const defaultPreferences = {
  homeAirport: "DEN",
  preferredAirline: "United / Star Alliance preferred, all airlines searched",
  tripLength: "7 nights",
  lodging:
    "Apartments, villas, chateaux, riads, artist guesthouses, and unusual longer-stay rentals",
  style: "Art, food, gardens, landscape, architecture, quiet bases, trains, slow travel"
};
