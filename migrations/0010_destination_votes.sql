CREATE TABLE IF NOT EXISTS destination_votes (
  destination_slug TEXT NOT NULL,
  user_name TEXT NOT NULL,
  starred_at TEXT,
  hidden_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (destination_slug, user_name)
);

CREATE INDEX IF NOT EXISTS idx_destination_votes_slug
  ON destination_votes (destination_slug, updated_at);

CREATE INDEX IF NOT EXISTS idx_destination_votes_user
  ON destination_votes (user_name, updated_at);
