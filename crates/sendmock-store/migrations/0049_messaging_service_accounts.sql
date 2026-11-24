-- A Messaging Service belongs to the Twilio account that made it, as on Twilio; null is the
-- main account, which owned every service before.
ALTER TABLE messaging_services ADD COLUMN account_sid TEXT;
