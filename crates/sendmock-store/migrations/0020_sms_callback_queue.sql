-- Status callback attempts double as their persistent retry queue, as webhook deliveries do:
-- an attempt is `pending`, `in_flight`, `succeeded`, `failed` or `exhausted`, and a `failed`
-- attempt with a retry due carries `next_attempt_at`. Attempts made before retries existed
-- were each sent once.
ALTER TABLE sms_callback_attempts ADD COLUMN status TEXT NOT NULL DEFAULT 'succeeded';
ALTER TABLE sms_callback_attempts ADD COLUMN next_attempt_at INTEGER;

UPDATE sms_callback_attempts SET status = 'failed' WHERE error_message IS NOT NULL;

CREATE INDEX sms_callback_attempts_due ON sms_callback_attempts (status, next_attempt_at);
