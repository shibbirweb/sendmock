-- Every call an inbound message made to your app: the reply webhook, its fallback, and each
-- TwiML `<Redirect>` or `action` fetch, with Twilio's error code and the verbs read from the
-- answer. Twilio does not retry reply webhooks, so these rows are a log, not a queue.
CREATE TABLE sms_reply_webhook_attempts (
    id TEXT PRIMARY KEY,
    sms_id TEXT NOT NULL REFERENCES sms_messages (id) ON DELETE CASCADE,
    is_fallback INTEGER NOT NULL,
    request TEXT NOT NULL,
    response TEXT,
    duration_ms INTEGER,
    error_code TEXT,
    error_message TEXT,
    twiml TEXT NOT NULL,
    created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX sms_reply_webhook_attempts_by_message ON sms_reply_webhook_attempts (sms_id, created_at);

-- The latest run's outcome as JSON, shown under the inbound bubble; a resend replaces it.
ALTER TABLE sms_messages ADD COLUMN reply_webhook TEXT;
