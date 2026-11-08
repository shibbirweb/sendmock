-- A detached endpoint's own copy of its template's request shape (method, content type, header
-- and body templates) as JSON, taken when it was detached. NULL while the endpoint is linked,
-- so it renders the template as it is now (WH-09.2).
ALTER TABLE webhook_endpoints ADD COLUMN detached_template TEXT;
