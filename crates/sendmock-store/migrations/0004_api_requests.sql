-- Requests to the native and provider APIs, rejected ones included, with the exact response.
CREATE TABLE api_requests (
    id TEXT PRIMARY KEY,
    api TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    request_headers TEXT NOT NULL,
    request_body TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    response_body TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    linked_message_kind TEXT,
    linked_message_id TEXT,
    created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX api_requests_by_api ON api_requests (api, id);
