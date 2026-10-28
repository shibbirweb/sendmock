-- Emails, their attachments, full-text search and timeline. Addresses, headers, tags and
-- extracted values are JSON; the raw message is zstd-compressed.
CREATE TABLE emails (
    id TEXT PRIMARY KEY,
    received_at INTEGER NOT NULL,
    message_id TEXT,
    subject TEXT NOT NULL,
    from_address TEXT NOT NULL,
    to_addresses TEXT NOT NULL,
    cc_addresses TEXT NOT NULL,
    bcc_addresses TEXT NOT NULL,
    reply_to_addresses TEXT NOT NULL,
    envelope_from TEXT NOT NULL,
    envelope_to TEXT NOT NULL,
    headers TEXT NOT NULL,
    text_body TEXT,
    html_body TEXT,
    snippet TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    attachment_count INTEGER NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL,
    source TEXT NOT NULL,
    direction TEXT NOT NULL,
    delivery_status TEXT,
    open_count INTEGER NOT NULL DEFAULT 0,
    opened_at INTEGER,
    otp_codes TEXT NOT NULL,
    links TEXT NOT NULL,
    smtp_session_id TEXT,
    smtp_auth_user TEXT,
    mime_tree TEXT NOT NULL,
    raw_message BLOB NOT NULL
) STRICT;

CREATE INDEX emails_by_received_at ON emails (received_at);

CREATE TABLE email_attachments (
    email_id TEXT NOT NULL REFERENCES emails (id) ON DELETE CASCADE,
    attachment_index INTEGER NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    content_id TEXT,
    is_inline INTEGER NOT NULL,
    content BLOB NOT NULL,
    PRIMARY KEY (email_id, attachment_index)
) STRICT;

CREATE TABLE email_timeline (
    email_id TEXT NOT NULL REFERENCES emails (id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    happened_at INTEGER NOT NULL,
    detail TEXT NOT NULL
) STRICT;

CREATE INDEX email_timeline_by_email ON email_timeline (email_id, happened_at);

-- Its own copy of the searchable text, keyed by the email's rowid and kept in step by triggers.
CREATE VIRTUAL TABLE emails_fts USING fts5 (subject, sender, recipients, body, tokenize = 'unicode61');

CREATE TRIGGER emails_fts_after_insert AFTER INSERT ON emails BEGIN
    INSERT INTO emails_fts (rowid, subject, sender, recipients, body)
    VALUES (new.rowid, new.subject, new.from_address, new.to_addresses || ' ' || new.cc_addresses, coalesce(new.text_body, new.snippet));
END;

CREATE TRIGGER emails_fts_after_delete AFTER DELETE ON emails BEGIN
    DELETE FROM emails_fts WHERE rowid = old.rowid;
END;
