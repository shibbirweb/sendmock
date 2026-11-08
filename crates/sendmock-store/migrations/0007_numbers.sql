-- Virtual numbers your app sends from, and the Messaging Services that pool them. A number's
-- service lives on the number, so it belongs to at most one service.
CREATE TABLE messaging_services (
    sid TEXT PRIMARY KEY,
    friendly_name TEXT NOT NULL,
    inbound_mode TEXT NOT NULL,
    inbound_url TEXT,
    inbound_fallback_url TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE virtual_numbers (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    channels TEXT NOT NULL,
    inbound_url TEXT,
    inbound_method TEXT NOT NULL,
    inbound_fallback_url TEXT,
    inbound_template_id TEXT,
    status_callback_url TEXT,
    messaging_service_sid TEXT REFERENCES messaging_services (sid) ON DELETE SET NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX virtual_numbers_messaging_service ON virtual_numbers (messaging_service_sid);
