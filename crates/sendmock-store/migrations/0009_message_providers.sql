-- Email and SMS provider definitions that differ from the shipped ones, and custom providers.
-- A built-in without a row answers as shipped, so an upgrade brings its new default.
-- `definition` is the provider as JSON, or NULL for a built-in kept as shipped (only removed).
CREATE TABLE message_providers (
    area TEXT NOT NULL,
    provider_key TEXT NOT NULL,
    definition TEXT,
    is_removed INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (area, provider_key)
);
