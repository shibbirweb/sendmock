-- An HTTP Catcher bin attached to a provider: requests on the provider's base URL that no
-- built-in operation answers are captured there and answered by its rules. A provider has at
-- most one bin; a bin can serve several providers.
CREATE TABLE provider_bins (
    area TEXT NOT NULL,
    provider_key TEXT NOT NULL,
    bin_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (area, provider_key)
);

CREATE INDEX provider_bins_by_bin ON provider_bins (bin_id);

-- The provider whose base URL a captured request arrived on.
ALTER TABLE http_captured_requests ADD COLUMN provider_key TEXT;

-- The bin and rule that answered a provider request no built-in operation answers.
ALTER TABLE api_requests ADD COLUMN catcher_bin_name TEXT;
ALTER TABLE api_requests ADD COLUMN catcher_rule_name TEXT;
