-- The seed file applied last, so reset can restore it and seed status can list what changed
-- since: its text, where it came from, when it was applied, and the configuration it left
-- (as SendMock exports it, so secrets are only references). One row at most.
CREATE TABLE seed_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    seed_toml TEXT NOT NULL,
    source_path TEXT,
    applied_at INTEGER NOT NULL,
    applied_items TEXT NOT NULL
) STRICT;
