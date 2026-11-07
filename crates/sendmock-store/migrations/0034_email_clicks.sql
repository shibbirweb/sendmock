-- Every recorded click on a link of an email, for the click history and `email.clicked`.
CREATE TABLE email_clicks (
    email_id TEXT NOT NULL REFERENCES emails (id) ON DELETE CASCADE,
    clicked_at INTEGER NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL,
    user_agent TEXT
) STRICT;

CREATE INDEX email_clicks_by_email ON email_clicks (email_id, clicked_at);
