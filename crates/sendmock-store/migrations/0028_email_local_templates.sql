-- Local stand-ins for provider-side email templates (SendGrid dynamic templates, Postmark and
-- Brevo templates), from the seed file's [[email.templates]]: a template send whose id matches
-- is stored with these bodies rendered from its template data.
CREATE TABLE email_local_templates (
    template_id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    text_body TEXT,
    html_body TEXT
) STRICT;
