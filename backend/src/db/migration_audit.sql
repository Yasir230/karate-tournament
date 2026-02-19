-- Audit log for score changes
CREATE TABLE IF NOT EXISTS score_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL,
  athlete_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_value INTEGER,
  new_value INTEGER,
  performed_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_match_id ON score_audit_log(match_id);
