CREATE TABLE IF NOT EXISTS studio_space_leads (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'new',
  kind TEXT NOT NULL DEFAULT 'unknown',
  title TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT,
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  posted_date TEXT,
  availability_text TEXT,
  price_text TEXT,
  duration_text TEXT,
  accommodation_note TEXT,
  workspace_note TEXT,
  contact_text TEXT,
  medium_tags TEXT,
  summary TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  was_saved INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT NOT NULL,
  raw_response_json TEXT,
  model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_space_leads_status
  ON studio_space_leads (status, updated_at);

CREATE INDEX IF NOT EXISTS idx_studio_space_leads_city
  ON studio_space_leads (city, country, updated_at);

CREATE INDEX IF NOT EXISTS idx_studio_space_leads_kind
  ON studio_space_leads (kind, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_studio_space_leads_hidden_saved
  ON studio_space_leads (status, was_saved, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_space_leads_source
  ON studio_space_leads (source_url, title, posted_date);
