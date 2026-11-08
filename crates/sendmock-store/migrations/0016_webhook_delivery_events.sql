-- The event a delivery carries, as JSON, so a replay can render it again with today's template
-- and variables (WH-05.2). NULL on rows queued before this column existed.
ALTER TABLE webhook_deliveries ADD COLUMN event TEXT;
