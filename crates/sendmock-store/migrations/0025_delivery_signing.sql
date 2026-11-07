-- Payment gateway notifications are deliveries that carry their provider's own signature
-- (Stripe-Signature, PayPal's transmission headers, SSLCommerz's verify_sign), so they are
-- sent without the endpoint's Standard Webhooks headers.
ALTER TABLE webhook_deliveries ADD COLUMN is_signed INTEGER NOT NULL DEFAULT 1;
