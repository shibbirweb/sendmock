-- Webhook variables, read in templates as `vars.<name>`. A null `endpoint_id` makes a global
-- variable; an endpoint's own variable wins over a global one of the same name. `fixed_value` is
-- the generated value of a Fixed random variable. Secrets are stored as written and masked
-- whenever they are shown.
CREATE TABLE webhook_variables (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    endpoint_id TEXT,
    value TEXT NOT NULL,
    random_mode TEXT,
    fixed_value TEXT,
    description TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX webhook_variables_scope_name ON webhook_variables (COALESCE(endpoint_id, ''), name);
