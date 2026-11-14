-- Webhook templates the user owns: custom templates (`source` = 'custom') and edited built-in
-- templates (`source` = 'builtin'), which replace the shipped request shape until Reset to
-- default deletes the row. Shipped templates that were never edited have no row.
CREATE TABLE webhook_templates (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    name TEXT NOT NULL,
    service TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    events_json TEXT NOT NULL,
    required_variables_json TEXT NOT NULL,
    method TEXT NOT NULL,
    content_type TEXT NOT NULL,
    header_templates_json TEXT NOT NULL,
    body_template TEXT NOT NULL,
    revision INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- The last saved versions of a template, newest first; the operations layer keeps 20.
CREATE TABLE webhook_template_revisions (
    template_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    saved_at INTEGER NOT NULL,
    template_json TEXT NOT NULL,
    PRIMARY KEY (template_id, revision)
);
