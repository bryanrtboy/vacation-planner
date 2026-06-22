CREATE TABLE IF NOT EXISTS art_show_search_batches (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  term_labels_json TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (run_id) REFERENCES art_show_search_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_art_show_search_batches_run
  ON art_show_search_batches (run_id, status, started_at);

CREATE INDEX IF NOT EXISTS idx_art_show_search_batches_status
  ON art_show_search_batches (status, started_at);
