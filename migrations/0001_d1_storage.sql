CREATE TABLE IF NOT EXISTS usage_counters (
  service TEXT NOT NULL,
  day TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (service, day)
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  snapshot_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  mode TEXT,
  destination_slug TEXT NOT NULL,
  destination_name TEXT NOT NULL,
  origin TEXT,
  destination_query TEXT,
  depart_date TEXT,
  return_date TEXT,
  adults INTEGER,
  children INTEGER,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  min_price INTEGER,
  max_price INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  sampled_dates TEXT,
  retrieved_at TEXT,
  source_url TEXT,
  source_detail TEXT,
  source_kind TEXT NOT NULL,
  raw_provider_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_price_snapshots_lookup
  ON price_snapshots (kind, destination_slug, origin, depart_date, return_date, mode);

CREATE INDEX IF NOT EXISTS idx_price_snapshots_retrieved
  ON price_snapshots (retrieved_at);

CREATE TABLE IF NOT EXISTS watches (
  id TEXT PRIMARY KEY,
  destination_slug TEXT NOT NULL,
  destination_name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_watches_destination
  ON watches (destination_slug);

CREATE TABLE IF NOT EXISTS destination_candidates (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_destination_candidates_region
  ON destination_candidates (region);
