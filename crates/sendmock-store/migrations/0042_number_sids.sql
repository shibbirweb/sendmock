-- Twilio's IncomingPhoneNumbers API names numbers by a PN SID and lists them per account, so
-- each virtual number gets a stable SID and the account it belongs to (null: the main account).
ALTER TABLE virtual_numbers ADD COLUMN phone_number_sid TEXT;
ALTER TABLE virtual_numbers ADD COLUMN account_sid TEXT;
UPDATE virtual_numbers SET phone_number_sid = 'PN' || lower(hex(randomblob(16))) WHERE phone_number_sid IS NULL;
CREATE UNIQUE INDEX virtual_numbers_phone_number_sid ON virtual_numbers (phone_number_sid);
