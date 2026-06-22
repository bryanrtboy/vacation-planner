CREATE TABLE IF NOT EXISTS art_watch_terms (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS art_show_leads (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'new',
  artist TEXT NOT NULL,
  title TEXT NOT NULL,
  venue TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT,
  start_date TEXT,
  end_date TEXT,
  date_text TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  travel_reason TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  raw_response_json TEXT,
  model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_art_watch_terms_active
  ON art_watch_terms (active, updated_at);

CREATE INDEX IF NOT EXISTS idx_art_show_leads_status
  ON art_show_leads (status, updated_at);

CREATE INDEX IF NOT EXISTS idx_art_show_leads_artist
  ON art_show_leads (artist, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_art_show_leads_source
  ON art_show_leads (source_url, artist, title);

INSERT OR IGNORE INTO art_watch_terms (id, label, active, created_at, updated_at) VALUES
  ('william-adolphe-bouguereau', 'William-Adolphe Bouguereau', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('john-singer-sargent', 'John Singer Sargent', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('frederic-lord-leighton', 'Frederic Lord Leighton', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('john-william-waterhouse', 'John William Waterhouse', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('anselm-kiefer', 'Anselm Kiefer', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('berthe-morisot', 'Berthe Morisot', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('edouard-manet', 'Manet', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tara-donovan', 'Tara Donovan', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('claudio-bravo', 'Claudio Bravo', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hans-memling', 'Hans Memling', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('jean-baptiste-camille-corot', 'Jean-Baptiste-Camille Corot', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ruth-asawa', 'Ruth Asawa', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('yayoi-kusama', 'Yayoi Kusama', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ingres', 'Ingres', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('mark-bradford', 'Mark Bradford', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('francis-alys', 'Francis Alys', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('james-turrell', 'James Turrell', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('raphael', 'Raphael', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
