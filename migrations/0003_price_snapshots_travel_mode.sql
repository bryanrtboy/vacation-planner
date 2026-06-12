ALTER TABLE price_snapshots ADD COLUMN travel_mode TEXT;

CREATE INDEX IF NOT EXISTS idx_price_snapshots_travel_mode
  ON price_snapshots (kind, destination_slug, travel_mode, depart_date, return_date, mode);
