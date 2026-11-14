-- Files apps upload through the WhatsApp Cloud API's media endpoint, then send by their id.
CREATE TABLE whatsapp_media (
    id TEXT PRIMARY KEY,
    phone_number_id TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_name TEXT,
    sha256 TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    content BLOB NOT NULL,
    project_key TEXT NOT NULL DEFAULT 'default',
    created_at INTEGER NOT NULL
);
