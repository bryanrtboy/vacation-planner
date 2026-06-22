ALTER TABLE art_watch_terms
  ADD COLUMN last_searched_at TEXT;

CREATE INDEX IF NOT EXISTS idx_art_watch_terms_search_state
  ON art_watch_terms (active, last_searched_at, updated_at);
