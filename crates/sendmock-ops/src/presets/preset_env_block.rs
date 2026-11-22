//! The `.env` lines a preset prints for the app.

use crate::{OperationContext, RequestClient};

const HIDDEN_FOR_AGENTS: &str = "<shown in the CLI and the UI only>";

/// What the env block needs to know.
pub struct EnvBlockValues<'values> {
    pub mailgun_endpoint: &'values str,
    pub mailgun_scheme: &'values str,
    pub signing_key: &'values str,
    pub twilio_account_sid: &'values str,
    pub twilio_auth_token: &'values str,
}

/// The lines for a Laravel app on Mailgun and Twilio; secrets are hidden from MCP callers,
/// since agents never read secrets.
pub fn build_env_block(
    operation_context: &OperationContext,
    values: &EnvBlockValues<'_>,
) -> String {
    let is_agent = operation_context.request.client == RequestClient::Mcp;
    let reveal = |secret: &str| {
        if is_agent {
            HIDDEN_FOR_AGENTS.to_owned()
        } else {
            secret.to_owned()
        }
    };
    [
        "MAIL_MAILER=mailgun".to_owned(),
        "MAILGUN_DOMAIN=mg.example.test".to_owned(),
        "MAILGUN_SECRET=key-sendmock".to_owned(),
        format!("MAILGUN_ENDPOINT={}", values.mailgun_endpoint),
        format!("MAILGUN_SCHEME={}", values.mailgun_scheme),
        format!("MAILGUN_WEBHOOK_SIGNING_KEY={}", reveal(values.signing_key)),
        format!("TWILIO_ACCOUNT_SID={}", values.twilio_account_sid),
        format!("TWILIO_AUTH_TOKEN={}", reveal(values.twilio_auth_token)),
        "TWILIO_FROM=+15005550006".to_owned(),
    ]
    .join("\n")
}
