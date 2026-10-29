use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;

use crate::WebhookSecret;

const SIGNATURE_VERSION: &str = "v1";

/// The three Standard Webhooks headers of one delivery attempt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StandardWebhookHeaders {
    /// `webhook-id`: the same for every retry of one event.
    pub webhook_id: String,
    /// `webhook-timestamp`: seconds since the Unix epoch, as text.
    pub webhook_timestamp: String,
    /// `webhook-signature`: one `v1,<base64>` per signing secret, space separated.
    pub webhook_signature: String,
}

/// Signs a payload as the Standard Webhooks spec defines: HMAC-SHA256 over
/// `{webhook-id}.{webhook-timestamp}.{body}` with the secret's key, in base64.
pub fn sign_payload(
    signing_secret: &WebhookSecret,
    webhook_id: &str,
    timestamp_seconds: i64,
    payload: &str,
) -> String {
    let signed_content = format!("{webhook_id}.{timestamp_seconds}.{payload}");
    let Ok(mut mac) = <Hmac<Sha256> as KeyInit>::new_from_slice(signing_secret.key_bytes()) else {
        // HMAC takes keys of any length, so this branch never runs.
        return String::new();
    };
    mac.update(signed_content.as_bytes());
    format!(
        "{SIGNATURE_VERSION},{}",
        STANDARD.encode(mac.finalize().into_bytes())
    )
}

/// The headers for one attempt, signed with every secret given: the current one, and during
/// a rotation's overlap the previous one too, so receivers holding either secret verify it.
pub fn build_signed_headers(
    signing_secrets: &[&WebhookSecret],
    webhook_id: &str,
    timestamp_seconds: i64,
    payload: &str,
) -> StandardWebhookHeaders {
    let signatures: Vec<String> = signing_secrets
        .iter()
        .map(|signing_secret| sign_payload(signing_secret, webhook_id, timestamp_seconds, payload))
        .collect();
    StandardWebhookHeaders {
        webhook_id: webhook_id.to_owned(),
        webhook_timestamp: timestamp_seconds.to_string(),
        webhook_signature: signatures.join(" "),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SPEC_SECRET: &str = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
    const SPEC_WEBHOOK_ID: &str = "msg_p5jXN8AQM9LWM0D4loKWxJek";
    const SPEC_TIMESTAMP: i64 = 1_614_265_330;
    const SPEC_PAYLOAD: &str = r#"{"test": 2432232314}"#;

    fn spec_secret() -> WebhookSecret {
        WebhookSecret::parse(SPEC_SECRET).expect("the spec's secret parses")
    }

    // AC: WH-04.1
    #[test]
    fn the_signature_matches_the_standard_webhooks_test_vector() {
        let signature = sign_payload(
            &spec_secret(),
            SPEC_WEBHOOK_ID,
            SPEC_TIMESTAMP,
            SPEC_PAYLOAD,
        );

        assert_eq!(signature, "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=");
    }

    // AC: WH-04.3
    #[test]
    fn during_a_rotation_both_secrets_sign_the_same_attempt() {
        let previous_secret = spec_secret();
        let current_secret =
            WebhookSecret::parse("whsec_dGhlLW5ldy1zZWNyZXQta2V5").expect("valid secret");

        let headers = build_signed_headers(
            &[&current_secret, &previous_secret],
            SPEC_WEBHOOK_ID,
            SPEC_TIMESTAMP,
            SPEC_PAYLOAD,
        );

        let signatures: Vec<&str> = headers.webhook_signature.split(' ').collect();
        assert_eq!(signatures.len(), 2);
        assert_eq!(
            signatures[1],
            "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE="
        );
        assert_eq!(headers.webhook_timestamp, "1614265330");
    }
}
