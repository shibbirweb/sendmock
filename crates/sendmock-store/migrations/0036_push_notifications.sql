-- Push notifications apps send through FCM, Expo or OneSignal, as each provider received them.
CREATE TABLE push_notifications (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_message_id TEXT NOT NULL,
    device_token TEXT NOT NULL,
    platform TEXT,
    title TEXT,
    body TEXT,
    image_url TEXT,
    data_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL,
    error_reason TEXT,
    request_json TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    response_json TEXT NOT NULL,
    project_key TEXT NOT NULL DEFAULT 'default',
    created_at INTEGER NOT NULL
);

CREATE INDEX push_notifications_by_project ON push_notifications (project_key);
CREATE INDEX push_notifications_by_token ON push_notifications (device_token);
