-- HTTP catcher bins (one capture URL each, with its default reply and response rules) and
-- the requests captured in them, with any uploaded files.
CREATE TABLE http_bins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    preset TEXT,
    default_response_json TEXT NOT NULL,
    rules_json TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
);

CREATE TABLE http_captured_requests (
    id TEXT PRIMARY KEY,
    bin_id TEXT NOT NULL,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    path TEXT NOT NULL,
    query_json TEXT NOT NULL,
    headers_json TEXT NOT NULL,
    body TEXT NOT NULL,
    content_type TEXT,
    client_ip TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    response_headers_json TEXT NOT NULL,
    response_body TEXT NOT NULL,
    matched_rule_id TEXT,
    matched_rule_name TEXT,
    is_simulated_failure INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX http_captured_requests_bin ON http_captured_requests (bin_id, created_at);

CREATE TABLE http_captured_files (
    request_id TEXT NOT NULL,
    file_index INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    content BLOB NOT NULL,
    PRIMARY KEY (request_id, file_index)
);
