-- Webhook endpoints. The request settings (method, headers, body, retry policy, ...) are one JSON
-- document the operations layer owns; the signing secret before the last rotation keeps signing
-- until `previous_secret_expires_at`.
CREATE TABLE webhook_endpoints (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    request_settings TEXT NOT NULL,
    signing_secret TEXT NOT NULL,
    previous_signing_secret TEXT,
    previous_secret_expires_at INTEGER,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX webhook_endpoints_created_at ON webhook_endpoints (created_at);
