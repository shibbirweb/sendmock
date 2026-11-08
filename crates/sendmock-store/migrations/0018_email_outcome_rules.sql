-- Custom outcome addresses, checked in position order; the first enabled match wins.
CREATE TABLE email_outcome_rules (
    id TEXT PRIMARY KEY,
    position INTEGER NOT NULL,
    pattern TEXT NOT NULL,
    outcome TEXT NOT NULL,
    smtp_code TEXT,
    diagnostic TEXT,
    note TEXT NOT NULL DEFAULT '',
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX email_outcome_rules_position ON email_outcome_rules (position);
