-- Every SMTP session, failed ones included, with its transcript (capped by the server).
CREATE TABLE smtp_sessions (
    id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    remote_address TEXT NOT NULL,
    helo_name TEXT NOT NULL,
    tls_version TEXT,
    auth_mechanism TEXT,
    auth_user TEXT,
    result TEXT NOT NULL,
    failure_reason TEXT,
    email_ids TEXT NOT NULL,
    transcript TEXT NOT NULL
) STRICT;
