-- Mailgun-style routes for incoming email, run in priority order (lower first).
CREATE TABLE inbound_routes (
    id TEXT PRIMARY KEY,
    priority INTEGER NOT NULL,
    description TEXT NOT NULL,
    filter_json TEXT NOT NULL,
    actions_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX inbound_routes_priority ON inbound_routes (priority, created_at);
