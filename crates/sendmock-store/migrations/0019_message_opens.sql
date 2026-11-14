-- Every recorded open of an email or SMS, for the open history; the message keeps the count
-- and the first open time.
CREATE TABLE email_opens (
    email_id TEXT NOT NULL REFERENCES emails (id) ON DELETE CASCADE,
    opened_at INTEGER NOT NULL,
    source TEXT NOT NULL,
    user_agent TEXT
) STRICT;

CREATE INDEX email_opens_by_email ON email_opens (email_id, opened_at);

CREATE TABLE sms_opens (
    sms_id TEXT NOT NULL REFERENCES sms_messages (id) ON DELETE CASCADE,
    opened_at INTEGER NOT NULL,
    source TEXT NOT NULL,
    user_agent TEXT
) STRICT;

CREATE INDEX sms_opens_by_sms ON sms_opens (sms_id, opened_at);
