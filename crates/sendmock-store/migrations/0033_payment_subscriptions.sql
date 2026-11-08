-- Subscriptions, each with its own clock; the document is the operations' JSON.
CREATE TABLE payment_subscriptions (
    id TEXT PRIMARY KEY,
    document_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX payment_subscriptions_created_at ON payment_subscriptions (created_at);
