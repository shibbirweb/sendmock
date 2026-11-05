-- Test payments: the payment as a JSON document (amounts, customer, method reduced to brand,
-- last 4 and expiry, line items, redirect, timeline), with the fields the list filters and
-- counts by kept as columns. A checkout session is its payment, so it has no table of its own.
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    method_key TEXT,
    status TEXT NOT NULL,
    currency TEXT NOT NULL,
    document TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX payments_by_provider ON payments (provider, id);
CREATE INDEX payments_by_method ON payments (method_key);
