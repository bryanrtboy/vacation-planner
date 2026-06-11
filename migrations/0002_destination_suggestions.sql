CREATE TABLE IF NOT EXISTS destination_suggestions (
  id TEXT PRIMARY KEY,
  request_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  source TEXT NOT NULL DEFAULT 'gemini',
  prompt_kind TEXT NOT NULL,
  parent_slug TEXT,
  region TEXT,
  name TEXT NOT NULL,
  destination_slug TEXT,
  payload_json TEXT NOT NULL,
  raw_response_json TEXT,
  model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_destination_suggestions_status
  ON destination_suggestions (status, updated_at);

CREATE INDEX IF NOT EXISTS idx_destination_suggestions_request
  ON destination_suggestions (request_key);

CREATE INDEX IF NOT EXISTS idx_destination_suggestions_parent
  ON destination_suggestions (parent_slug);

CREATE INDEX IF NOT EXISTS idx_destination_suggestions_region
  ON destination_suggestions (region);
