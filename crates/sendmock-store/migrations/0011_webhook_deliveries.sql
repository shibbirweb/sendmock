-- Webhook deliveries, one row per attempt; the rows are also the persistent delivery queue.
-- `rendered_request` is the request before signing, reused by retries; `sent_request` is what
-- the attempt actually sent, signature headers included.
CREATE TABLE webhook_deliveries (
    id TEXT PRIMARY KEY,
    endpoint_id TEXT NOT NULL,
    endpoint_name TEXT NOT NULL,
    rule_id TEXT,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    subject_id TEXT,
    trigger TEXT NOT NULL,
    attempt INTEGER NOT NULL,
    status TEXT NOT NULL,
    retry_policy TEXT NOT NULL,
    rendered_request TEXT,
    sent_request TEXT,
    response TEXT,
    duration_ms INTEGER,
    error_message TEXT,
    next_attempt_at INTEGER,
    created_at INTEGER NOT NULL
);

CREATE INDEX webhook_deliveries_due ON webhook_deliveries (status, next_attempt_at);
CREATE INDEX webhook_deliveries_event ON webhook_deliveries (event_id, endpoint_id);
CREATE INDEX webhook_deliveries_endpoint ON webhook_deliveries (endpoint_id);
