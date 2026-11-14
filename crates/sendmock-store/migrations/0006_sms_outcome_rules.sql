-- Custom outcome numbers, checked in position order; the first enabled match wins.
CREATE TABLE sms_outcome_rules (
    id TEXT PRIMARY KEY,
    position INTEGER NOT NULL,
    match_field TEXT NOT NULL,
    pattern TEXT NOT NULL,
    outcome TEXT NOT NULL,
    error_code TEXT,
    delay_seconds INTEGER,
    note TEXT NOT NULL DEFAULT '',
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX sms_outcome_rules_position ON sms_outcome_rules (position);
