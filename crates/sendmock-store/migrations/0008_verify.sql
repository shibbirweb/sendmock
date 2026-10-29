-- Twilio Verify: services, the verifications apps start, and each verification's timeline.
-- A verification keeps its service's name, so it still reads well after the service is deleted.
CREATE TABLE verify_services (
    sid TEXT PRIMARY KEY,
    friendly_name TEXT NOT NULL,
    code_length INTEGER NOT NULL,
    fixed_code TEXT,
    ttl_seconds INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE verifications (
    sid TEXT PRIMARY KEY,
    service_sid TEXT NOT NULL,
    service_name TEXT NOT NULL,
    account_sid TEXT,
    to_address TEXT NOT NULL,
    channel TEXT NOT NULL,
    code TEXT NOT NULL,
    status TEXT NOT NULL,
    check_attempts INTEGER NOT NULL DEFAULT 0,
    send_attempts INTEGER NOT NULL DEFAULT 1,
    expires_at INTEGER NOT NULL,
    linked_message_id TEXT,
    linked_thread_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX verifications_by_recipient ON verifications (service_sid, to_address, status);

CREATE TABLE verification_timeline (
    verification_sid TEXT NOT NULL REFERENCES verifications (sid) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    kind TEXT NOT NULL,
    at INTEGER NOT NULL,
    detail TEXT NOT NULL,
    PRIMARY KEY (verification_sid, sequence)
);
