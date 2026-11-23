-- Opt-out keywords (Twilio's Advanced Opt-Out) can be turned off for one number or one
-- Messaging Service; on unless turned off.
ALTER TABLE virtual_numbers ADD COLUMN opt_out_keywords INTEGER NOT NULL DEFAULT 1;
ALTER TABLE messaging_services ADD COLUMN opt_out_keywords INTEGER NOT NULL DEFAULT 1;
