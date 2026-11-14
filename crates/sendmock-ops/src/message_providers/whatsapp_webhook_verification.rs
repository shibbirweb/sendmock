//! Meta's callback URL check: before Meta sends a WhatsApp webhook it calls the URL with
//! `GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`, and the app must answer the
//! challenge. This operation makes the same call, so an app's handler can be checked first.

use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::providers::load_sms_provider_definitions;
use crate::sms::{HttpCallResult, RecordedHttpRequest};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

const WHATSAPP_CLOUD_PROVIDER_KEY: &str = "whatsapp_cloud";

/// Body of POST /api/v1/sms/whatsapp-cloud/verify-webhook.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, JsonSchema)]
pub struct WhatsappWebhookVerificationRequest {
    /// The URL to check; the WhatsApp Cloud provider's `webhook_url` when left out.
    pub url: Option<String>,
}

/// What the app answered Meta's check.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct WhatsappWebhookVerification {
    /// The URL called, with the check's query.
    pub url: String,
    /// The `hub.challenge` sent, which the app must answer as its whole body.
    pub challenge: String,
    /// True when the app answered `200` with exactly the challenge, as Meta requires.
    pub is_verified: bool,
    #[schemars(required, schema_with = "crate::nullable_schema::<u16>")]
    pub status_code: Option<u16>,
    /// The app's answer body.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub answer: Option<String>,
    /// Why there was no answer, such as a refused connection.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub error: Option<String>,
}

fn invalid_input(message: &str) -> OperationError {
    OperationError::InvalidInput {
        field: Some("url".to_owned()),
        message: message.to_owned(),
    }
}

/// The URL from the request, else the provider's `webhook_url`, and the provider's
/// `verify_token`.
async fn read_check_target(
    operation_context: &OperationContext,
    requested_url: Option<String>,
) -> Result<(String, String), OperationError> {
    let providers = load_sms_provider_definitions(operation_context).await?;
    let cloud_provider = providers
        .iter()
        .find(|provider| provider.key == WHATSAPP_CLOUD_PROVIDER_KEY);
    let read_credential = |credential_name: &str| {
        cloud_provider
            .and_then(|provider| {
                provider
                    .credentials
                    .iter()
                    .find(|credential| credential.name == credential_name)
            })
            .map(|credential| credential.value.clone())
            .filter(|value| !value.is_empty())
    };
    let callback_url = requested_url
        .filter(|url| !url.trim().is_empty())
        .or_else(|| read_credential("webhook_url"))
        .ok_or_else(|| {
            invalid_input("Set the WhatsApp Cloud provider's webhook_url, or pass url")
        })?;
    Ok((
        callback_url,
        read_credential("verify_token").unwrap_or_default(),
    ))
}

fn build_check_url(callback_url: &str, verify_token: &str, challenge: &str) -> String {
    let check_query = serde_urlencoded::to_string([
        ("hub.mode", "subscribe"),
        ("hub.verify_token", verify_token),
        ("hub.challenge", challenge),
    ])
    .unwrap_or_default();
    let separator = if callback_url.contains('?') { '&' } else { '?' };
    format!("{callback_url}{separator}{check_query}")
}

pub struct VerifyWhatsappWebhookOperation;

impl Operation for VerifyWhatsappWebhookOperation {
    type Input = WhatsappWebhookVerificationRequest;
    type Output = WhatsappWebhookVerification;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSmsWhatsappCloudVerifyWebhook",
            method: HttpMethod::Post,
            path: "/api/v1/sms/whatsapp-cloud/verify-webhook",
            summary: "Send Meta's callback URL check to the app and report whether it answered the challenge.",
            cli_usage: "sendmock sms whatsapp-cloud verify-webhook",
            mcp_tool: "sendmock_sms_whatsapp_verify_webhook",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WhatsappWebhookVerificationRequest,
    ) -> Result<WhatsappWebhookVerification, OperationError> {
        let (callback_url, verify_token) = read_check_target(operation_context, input.url).await?;
        let challenge = (operation_context.random_source.next_u64() % 9_000_000_000
            + 1_000_000_000)
            .to_string();
        let check_request = RecordedHttpRequest {
            method: "GET".to_owned(),
            url: build_check_url(&callback_url, &verify_token, &challenge),
            headers: BTreeMap::from([("User-Agent".to_owned(), "facebookexternalua".to_owned())]),
            body: String::new(),
        };
        let call_result = match operation_context.reply_webhook_sender.as_ref() {
            Some(http_sender) => http_sender.send_reply_webhook(&check_request).await,
            None => HttpCallResult {
                response: None,
                error_message: Some("No HTTP client is configured to call the app".to_owned()),
                is_connection_failure: true,
                duration_ms: 0,
            },
        };
        let status_code = call_result
            .response
            .as_ref()
            .map(|response| response.status_code);
        let answer = call_result.response.map(|response| response.body);
        Ok(WhatsappWebhookVerification {
            is_verified: status_code == Some(200)
                && answer.as_deref().map(str::trim) == Some(challenge.as_str()),
            url: check_request.url,
            challenge,
            status_code,
            answer,
            error: call_result.error_message,
        })
    }
}
