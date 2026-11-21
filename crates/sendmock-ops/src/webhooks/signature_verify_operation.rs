//! `webhook.signature.verify`: checks a captured request's signature, or one given inline,
//! as the receiving app should (WH-15.5).

use std::collections::BTreeMap;

use schemars::JsonSchema;
use sendmock_webhooks::{DigestEncoding, SignatureScheme, SignedRequest, verify_signature};
use serde::{Deserialize, Serialize};

use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

const DEFAULT_TOLERANCE_SECONDS: u32 = 300;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum SignatureSchemeName {
    StandardWebhooks,
    Stripe,
    Hmac,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum DigestEncodingName {
    #[default]
    Hex,
    Base64,
}

/// Body of `POST /api/v1/webhooks/signatures/verify`.
#[derive(Clone, Deserialize, JsonSchema)]
pub struct SignatureVerifyRequest {
    /// `standard_webhooks`, `stripe` or `hmac`.
    pub scheme: SignatureSchemeName,
    /// The signing secret the app checks with; never logged.
    pub secret: String,
    /// A captured request's ID, from an HTTP Catcher bin; or give `headers` and `body`.
    #[serde(default)]
    pub request_id: Option<String>,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
    #[serde(default)]
    pub body: Option<String>,
    /// For `hmac`: the header holding the digest [default: X-Signature].
    #[serde(default)]
    pub header: Option<String>,
    /// For `hmac`: `hex` or `base64` [default: hex].
    #[serde(default)]
    pub encoding: DigestEncodingName,
    /// For `hmac`: text before the digest, such as `sha256=` [default: none].
    #[serde(default)]
    pub prefix: Option<String>,
    /// How far a signed timestamp may be from now, in seconds [default: 300].
    #[serde(default)]
    pub tolerance_seconds: Option<u32>,
}

/// Answer of `POST /api/v1/webhooks/signatures/verify`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct SignatureVerification {
    pub is_valid: bool,
    pub scheme: SignatureSchemeName,
    /// Why it does not check out; null when it does.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub reason: Option<String>,
}

fn build_scheme(input: &SignatureVerifyRequest) -> SignatureScheme {
    match input.scheme {
        SignatureSchemeName::StandardWebhooks => SignatureScheme::StandardWebhooks,
        SignatureSchemeName::Stripe => SignatureScheme::Stripe,
        SignatureSchemeName::Hmac => SignatureScheme::Hmac {
            header_name: input
                .header
                .clone()
                .unwrap_or_else(|| "X-Signature".to_owned()),
            encoding: match input.encoding {
                DigestEncodingName::Hex => DigestEncoding::Hex,
                DigestEncodingName::Base64 => DigestEncoding::Base64,
            },
            prefix: input.prefix.clone().unwrap_or_default(),
        },
    }
}

/// The headers (names in lowercase) and body to check: the captured request's, or the input's.
async fn read_signed_parts(
    operation_context: &OperationContext,
    input: &SignatureVerifyRequest,
) -> Result<(BTreeMap<String, String>, String), OperationError> {
    let Some(request_id) = &input.request_id else {
        let headers = input
            .headers
            .iter()
            .map(|(header_name, header_value)| {
                (header_name.to_ascii_lowercase(), header_value.clone())
            })
            .collect();
        return Ok((headers, input.body.clone().unwrap_or_default()));
    };
    let captured_request = operation_context
        .http_catcher_stores
        .requests
        .find_request(request_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No captured request with the ID {request_id}"),
        })?;
    let headers = serde_json::from_str(&captured_request.headers_json).unwrap_or_default();
    Ok((headers, captured_request.body))
}

pub struct VerifyWebhookSignatureOperation;

impl Operation for VerifyWebhookSignatureOperation {
    type Input = SignatureVerifyRequest;
    type Output = SignatureVerification;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postWebhooksSignaturesVerify",
            method: HttpMethod::Post,
            path: "/api/v1/webhooks/signatures/verify",
            summary: "Check a captured request's webhook signature: Standard Webhooks, Stripe or an HMAC header.",
            is_read_only: true,
            cli_usage: "sendmock webhook signature verify",
            mcp_tool: "sendmock_webhook_signature_verify",
            success_flag_field: Some("is_valid"),
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SignatureVerifyRequest,
    ) -> Result<SignatureVerification, OperationError> {
        let (headers, body) = read_signed_parts(operation_context, &input).await?;
        let verification = verify_signature(
            &build_scheme(&input),
            &input.secret,
            &SignedRequest {
                headers: &headers,
                body: &body,
            },
            operation_context.clock.now_unix_ms().div_euclid(1_000),
            i64::from(input.tolerance_seconds.unwrap_or(DEFAULT_TOLERANCE_SECONDS)),
        );
        Ok(SignatureVerification {
            is_valid: verification.is_ok(),
            scheme: input.scheme,
            reason: verification.err().map(|mismatch| mismatch.0),
        })
    }
}
