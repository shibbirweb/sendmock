-- What an email provider's HTTP API was asked for each email it stored: the provider's own
-- message id (so its webhooks and fetch calls can name the email) and a template send's id
-- and data, shown in the email's Template data tab.
CREATE TABLE email_provider_sends (
    email_id TEXT PRIMARY KEY REFERENCES emails (id) ON DELETE CASCADE,
    provider_key TEXT NOT NULL,
    provider_message_id TEXT NOT NULL,
    template_id TEXT,
    template_data TEXT
) STRICT;

CREATE INDEX email_provider_sends_by_message_id
    ON email_provider_sends (provider_key, provider_message_id);
