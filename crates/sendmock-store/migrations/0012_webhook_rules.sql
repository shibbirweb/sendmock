-- Webhook rules, checked in position order; each enabled match queues one delivery. `events` and
-- `filter` are JSON documents the operations layer owns.
CREATE TABLE webhook_rules (
    id TEXT PRIMARY KEY,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    endpoint_id TEXT NOT NULL,
    events TEXT NOT NULL,
    filter TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX webhook_rules_position ON webhook_rules (position);
CREATE INDEX webhook_rules_endpoint ON webhook_rules (endpoint_id);
