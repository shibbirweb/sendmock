-- Why SendMock answered a request as it did when the answer alone does not say, such as the
-- reason for a Twilio 401.
ALTER TABLE api_requests ADD COLUMN note TEXT;
