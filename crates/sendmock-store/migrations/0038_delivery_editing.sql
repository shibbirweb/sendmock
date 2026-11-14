-- A simulation can send an edited payload to an endpoint; the delivery log marks it, so the
-- request shown is known to be the one typed, not the one the template renders.
ALTER TABLE webhook_deliveries ADD COLUMN is_edited INTEGER NOT NULL DEFAULT 0;
