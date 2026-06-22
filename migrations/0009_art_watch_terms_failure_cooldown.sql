ALTER TABLE art_watch_terms ADD COLUMN last_failed_at TEXT;
ALTER TABLE art_watch_terms ADD COLUMN search_failure_count INTEGER NOT NULL DEFAULT 0;
