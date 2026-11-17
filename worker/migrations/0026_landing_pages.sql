-- Ad campaign landing pages are independent of the informational footer CMS.
-- Content is bounded structured JSON so the editor can add sections without a schema migration.
CREATE TABLE IF NOT EXISTS landing_pages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  content_json TEXT NOT NULL DEFAULT '{}',
  published    INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at   INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_landing_pages_published ON landing_pages(published, updated_at DESC);
CREATE TRIGGER IF NOT EXISTS trg_landing_pages_touch
AFTER UPDATE ON landing_pages FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE landing_pages SET updated_at = strftime('%s','now') WHERE id = NEW.id;
END;
