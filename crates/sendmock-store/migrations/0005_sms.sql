-- SMS and WhatsApp messages in both directions, with their media, status history and the
-- status callbacks sent for them.
CREATE TABLE sms_messages (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    channel TEXT NOT NULL,
    api TEXT NOT NULL,
    from_number TEXT NOT NULL,
    from_raw TEXT NOT NULL,
    to_number TEXT NOT NULL,
    to_raw TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    app_number TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    body TEXT NOT NULL,
    encoding TEXT NOT NULL,
    segments INTEGER NOT NULL,
    status TEXT NOT NULL,
    error_code TEXT,
    status_callback_url TEXT,
    messaging_service_sid TEXT,
    account TEXT,
    otp_codes TEXT NOT NULL,
    links TEXT NOT NULL,
    metadata TEXT,
    request_body TEXT,
    api_request_id TEXT,
    opened_at INTEGER,
    open_count INTEGER NOT NULL DEFAULT 0,
    is_read INTEGER NOT NULL DEFAULT 0,
    in_reply_to_sms_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX sms_messages_by_thread ON sms_messages (thread_id, id);
CREATE INDEX sms_messages_by_recipient ON sms_messages (to_number, id);
CREATE INDEX sms_messages_by_provider_id ON sms_messages (provider_id);

CREATE TABLE sms_media (
    sms_id TEXT NOT NULL REFERENCES sms_messages (id) ON DELETE CASCADE,
    media_index INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    filename TEXT,
    source_url TEXT,
    size_bytes INTEGER NOT NULL,
    content BLOB NOT NULL,
    PRIMARY KEY (sms_id, media_index)
) STRICT;

CREATE TABLE sms_status_history (
    sms_id TEXT NOT NULL REFERENCES sms_messages (id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    status TEXT NOT NULL,
    error_code TEXT,
    at INTEGER NOT NULL,
    PRIMARY KEY (sms_id, sequence)
) STRICT;

CREATE TABLE sms_callback_attempts (
    id TEXT PRIMARY KEY,
    sms_id TEXT NOT NULL REFERENCES sms_messages (id) ON DELETE CASCADE,
    reported_status TEXT NOT NULL,
    attempt INTEGER NOT NULL,
    request TEXT NOT NULL,
    response TEXT,
    duration_ms INTEGER,
    error_message TEXT,
    created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX sms_callback_attempts_by_message ON sms_callback_attempts (sms_id, created_at);
