-- A provider send's user variables (Mailgun's `v:` fields and `X-Mailgun-Variables`), as one
-- JSON object, so webhooks for the email carry them as the provider's own webhooks do.
ALTER TABLE email_provider_sends ADD COLUMN user_variables TEXT;
