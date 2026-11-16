-- Push notifications and captured HTTP requests get read state, as emails and SMS have:
-- new rows arrive unread, and rows stored before this count as read, so an upgrade does not
-- light up every badge.
ALTER TABLE push_notifications ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0;
UPDATE push_notifications SET is_read = 1;
ALTER TABLE http_captured_requests ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0;
UPDATE http_captured_requests SET is_read = 1;
