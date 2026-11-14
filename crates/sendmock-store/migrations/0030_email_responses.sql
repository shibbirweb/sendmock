-- A simulated reply or forward and the email it answers, so each links to the other.
CREATE TABLE email_responses (
    email_id TEXT PRIMARY KEY,
    response_kind TEXT NOT NULL,
    original_email_id TEXT NOT NULL
);

CREATE INDEX email_responses_original ON email_responses (original_email_id);
