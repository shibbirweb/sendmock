-- Subaccounts under the Twilio provider's main account, each with its own auth token and the
-- Debugger webhook URL it can set. The main account stays in the provider's credentials.
CREATE TABLE twilio_subaccounts (
    account_sid TEXT PRIMARY KEY,
    friendly_name TEXT NOT NULL,
    auth_token TEXT NOT NULL,
    status TEXT NOT NULL,
    debugger_url TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
