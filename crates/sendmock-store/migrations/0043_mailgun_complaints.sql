-- Mailgun's events and complaints are per sending domain, the `{domain}` of the send path, so
-- a provider send keeps it. Complaints are kept per domain and address, as Mailgun's
-- complaints table is, and a send to a listed address is not delivered.
ALTER TABLE email_provider_sends ADD COLUMN sending_domain TEXT;
CREATE INDEX email_provider_sends_by_domain ON email_provider_sends (provider_key, sending_domain);

CREATE TABLE mailgun_complaints (
    domain TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (domain, address)
) STRICT;
