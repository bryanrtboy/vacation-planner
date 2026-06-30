ALTER TABLE art_show_leads
  ADD COLUMN was_saved INTEGER NOT NULL DEFAULT 0;

UPDATE art_show_leads
SET was_saved = 1
WHERE status = 'saved';

CREATE INDEX IF NOT EXISTS idx_art_show_leads_hidden_saved
  ON art_show_leads (status, was_saved, updated_at);
