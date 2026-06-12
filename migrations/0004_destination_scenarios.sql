CREATE TABLE IF NOT EXISTS destination_scenarios (
  destination_slug TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_destination_scenarios_updated
  ON destination_scenarios (updated_at);
