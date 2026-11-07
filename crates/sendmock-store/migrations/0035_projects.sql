-- Projects keep captured traffic apart inside one instance. `default` always exists and holds
-- every email, SMS and verification not sent to another project, including those stored
-- before projects existed.
CREATE TABLE projects (
    project_key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

INSERT INTO projects (project_key, name, created_at) VALUES ('default', 'Default', 0);

ALTER TABLE emails ADD COLUMN project_key TEXT NOT NULL DEFAULT 'default';
ALTER TABLE sms_messages ADD COLUMN project_key TEXT NOT NULL DEFAULT 'default';
ALTER TABLE verifications ADD COLUMN project_key TEXT NOT NULL DEFAULT 'default';

CREATE INDEX emails_by_project ON emails (project_key);
CREATE INDEX sms_messages_by_project ON sms_messages (project_key);
CREATE INDEX verifications_by_project ON verifications (project_key);
