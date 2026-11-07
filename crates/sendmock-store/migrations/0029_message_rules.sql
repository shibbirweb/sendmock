-- Rules applied to each arriving email in position order: tag rules add `action` (a tag),
-- forward rules release it to `action` (a JSON list of addresses).
CREATE TABLE tag_rules (
    id TEXT PRIMARY KEY,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    filter_json TEXT,
    action TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
);

CREATE INDEX tag_rules_position ON tag_rules (position);

CREATE TABLE forward_rules (
    id TEXT PRIMARY KEY,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    filter_json TEXT,
    action TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
);

CREATE INDEX forward_rules_position ON forward_rules (position);
