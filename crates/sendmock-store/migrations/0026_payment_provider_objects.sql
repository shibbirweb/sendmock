-- A provider adapter's own objects beside a payment (a Stripe refund, the PaymentMethod
-- attached to a PaymentIntent), kept as the adapter's JSON under the provider's id so the
-- payment itself stays provider-neutral.
CREATE TABLE payment_provider_objects (
    object_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    object_kind TEXT NOT NULL,
    payment_id TEXT NOT NULL REFERENCES payments (id) ON DELETE CASCADE,
    document TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX payment_provider_objects_by_payment ON payment_provider_objects (payment_id, object_kind, created_at);
