//! Checks a webhook's signature the way the receiving app should (WH-15.5): Standard
//! Webhooks, Stripe's `Stripe-Signature`, or an HMAC of the body in one header.

use std::collections::BTreeMap;
use std::fmt::Write as _;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;

use crate::{WebhookSecret, sign_payload};

/// How an HMAC header encodes the digest.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DigestEncoding {
    Hex,
    Base64,
}

/// The signature scheme to check.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SignatureScheme {
    /// `webhook-id`, `webhook-timestamp` and `webhook-signature`, with a `whsec_` secret.
    StandardWebhooks,
    /// `Stripe-Signature: t=...,v1=...` over `{t}.{body}`.
    Stripe,
    /// HMAC-SHA256 of the body in one header, after an optional prefix such as `sha256=`.
    Hmac {
        header_name: String,
        encoding: DigestEncoding,
        prefix: String,
    },
}

/// A received request: header names in lowercase, and the body as sent.
pub struct SignedRequest<'request> {
    pub headers: &'request BTreeMap<String, String>,
    pub body: &'request str,
}

/// Why a signature does not check out.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("{0}")]
pub struct SignatureMismatch(pub String);

fn mismatch(reason: impl Into<String>) -> SignatureMismatch {
    SignatureMismatch(reason.into())
}

fn hmac_sha256(key: &[u8], content: &[u8]) -> Vec<u8> {
    let Ok(mut mac) = <Hmac<Sha256> as KeyInit>::new_from_slice(key) else {
        // HMAC takes keys of any length, so this branch never runs.
        return Vec::new();
    };
    mac.update(content);
    mac.finalize().into_bytes().to_vec()
}

fn to_hex(digest: &[u8]) -> String {
    digest.iter().fold(String::new(), |mut hex_text, byte| {
        let _ = write!(hex_text, "{byte:02x}");
        hex_text
    })
}

fn read_header<'request>(
    request: &SignedRequest<'request>,
    header_name: &str,
) -> Result<&'request str, SignatureMismatch> {
    request
        .headers
        .get(&header_name.to_ascii_lowercase())
        .map(String::as_str)
        .ok_or_else(|| mismatch(format!("The {header_name} header is missing")))
}

fn check_timestamp(
    timestamp_text: &str,
    now_unix_seconds: i64,
    tolerance_seconds: i64,
) -> Result<i64, SignatureMismatch> {
    let timestamp_seconds: i64 = timestamp_text
        .trim()
        .parse()
        .map_err(|_| mismatch(format!("The timestamp {timestamp_text} is not a number")))?;
    if (now_unix_seconds - timestamp_seconds).abs() > tolerance_seconds {
        return Err(mismatch(format!(
            "The timestamp is more than {tolerance_seconds} seconds from now"
        )));
    }
    Ok(timestamp_seconds)
}

fn verify_standard_webhooks(
    secret: &str,
    request: &SignedRequest<'_>,
    now_unix_seconds: i64,
    tolerance_seconds: i64,
) -> Result<(), SignatureMismatch> {
    let signing_secret = WebhookSecret::parse(secret.trim())
        .map_err(|_| mismatch("The secret is not a whsec_ Standard Webhooks secret"))?;
    let webhook_id = read_header(request, "webhook-id")?;
    let timestamp_seconds = check_timestamp(
        read_header(request, "webhook-timestamp")?,
        now_unix_seconds,
        tolerance_seconds,
    )?;
    let expected_signature =
        sign_payload(&signing_secret, webhook_id, timestamp_seconds, request.body);
    let is_signed = read_header(request, "webhook-signature")?
        .split_whitespace()
        .any(|sent_signature| sent_signature == expected_signature);
    is_signed
        .then_some(())
        .ok_or_else(|| mismatch("No webhook-signature matches the secret"))
}

fn verify_stripe(
    secret: &str,
    request: &SignedRequest<'_>,
    now_unix_seconds: i64,
    tolerance_seconds: i64,
) -> Result<(), SignatureMismatch> {
    let signature_header = read_header(request, "stripe-signature")?;
    let header_parts: Vec<(&str, &str)> = signature_header
        .split(',')
        .filter_map(|header_part| header_part.trim().split_once('='))
        .collect();
    let timestamp_text = header_parts
        .iter()
        .find(|(part_name, _)| *part_name == "t")
        .map(|(_, part_value)| *part_value)
        .ok_or_else(|| mismatch("Stripe-Signature has no t= timestamp"))?;
    check_timestamp(timestamp_text, now_unix_seconds, tolerance_seconds)?;
    let expected_signature = to_hex(&hmac_sha256(
        secret.trim().as_bytes(),
        format!("{timestamp_text}.{}", request.body).as_bytes(),
    ));
    let is_signed = header_parts
        .iter()
        .any(|(part_name, part_value)| *part_name == "v1" && *part_value == expected_signature);
    is_signed
        .then_some(())
        .ok_or_else(|| mismatch("No v1 signature in Stripe-Signature matches the secret"))
}

fn verify_hmac(
    secret: &str,
    request: &SignedRequest<'_>,
    header_name: &str,
    encoding: DigestEncoding,
    prefix: &str,
) -> Result<(), SignatureMismatch> {
    let sent_signature = read_header(request, header_name)?.trim();
    let sent_digest = sent_signature
        .strip_prefix(prefix)
        .unwrap_or(sent_signature);
    let digest = hmac_sha256(secret.as_bytes(), request.body.as_bytes());
    let expected_digest = match encoding {
        DigestEncoding::Hex => to_hex(&digest),
        DigestEncoding::Base64 => STANDARD.encode(&digest),
    };
    let is_signed = match encoding {
        DigestEncoding::Hex => sent_digest.eq_ignore_ascii_case(&expected_digest),
        DigestEncoding::Base64 => sent_digest == expected_digest,
    };
    is_signed.then_some(()).ok_or_else(|| {
        mismatch(format!(
            "{header_name} does not match an HMAC-SHA256 of the body"
        ))
    })
}

/// Checks the request's signature with the secret; timestamps must be within the tolerance.
pub fn verify_signature(
    scheme: &SignatureScheme,
    secret: &str,
    request: &SignedRequest<'_>,
    now_unix_seconds: i64,
    tolerance_seconds: i64,
) -> Result<(), SignatureMismatch> {
    match scheme {
        SignatureScheme::StandardWebhooks => {
            verify_standard_webhooks(secret, request, now_unix_seconds, tolerance_seconds)
        }
        SignatureScheme::Stripe => {
            verify_stripe(secret, request, now_unix_seconds, tolerance_seconds)
        }
        SignatureScheme::Hmac {
            header_name,
            encoding,
            prefix,
        } => verify_hmac(secret, request, header_name, *encoding, prefix),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_767_225_600;
    const BODY: &str = "{\"type\":\"order.paid\"}";

    fn headers(pairs: &[(&str, String)]) -> BTreeMap<String, String> {
        pairs
            .iter()
            .map(|(header_name, header_value)| ((*header_name).to_owned(), header_value.clone()))
            .collect()
    }

    // AC: WH-15.5
    #[test]
    fn a_standard_webhooks_signature_checks_out_and_a_changed_body_does_not() {
        let secret = "whsec_c2VuZG1vY2stdGVzdC1rZXktMDAwMQ==";
        let signing_secret = WebhookSecret::parse(secret).unwrap_or_else(|_| panic!("a secret"));
        let sent_headers = headers(&[
            ("webhook-id", "msg_1".to_owned()),
            ("webhook-timestamp", NOW.to_string()),
            (
                "webhook-signature",
                sign_payload(&signing_secret, "msg_1", NOW, BODY),
            ),
        ]);
        let signed = SignedRequest {
            headers: &sent_headers,
            body: BODY,
        };
        let changed = SignedRequest {
            headers: &sent_headers,
            body: "{}",
        };

        assert_eq!(
            verify_signature(
                &SignatureScheme::StandardWebhooks,
                secret,
                &signed,
                NOW,
                300
            ),
            Ok(())
        );
        assert!(
            verify_signature(
                &SignatureScheme::StandardWebhooks,
                secret,
                &changed,
                NOW,
                300
            )
            .is_err()
        );
        assert!(
            verify_signature(
                &SignatureScheme::StandardWebhooks,
                secret,
                &signed,
                NOW + 900,
                300
            )
            .is_err_and(|mismatch| mismatch.0.contains("seconds from now"))
        );
    }

    // AC: WH-15.5
    #[test]
    fn a_stripe_signature_and_a_prefixed_hmac_header_check_out() {
        let stripe_secret = "whsec_stripe_test";
        let stripe_signature = to_hex(&hmac_sha256(
            stripe_secret.as_bytes(),
            format!("{NOW}.{BODY}").as_bytes(),
        ));
        let stripe_headers =
            headers(&[("stripe-signature", format!("t={NOW},v1={stripe_signature}"))]);
        let hmac_headers = headers(&[(
            "x-hub-signature-256",
            format!(
                "sha256={}",
                to_hex(&hmac_sha256(b"shop-secret", BODY.as_bytes()))
            ),
        )]);
        let hmac_scheme = SignatureScheme::Hmac {
            header_name: "X-Hub-Signature-256".to_owned(),
            encoding: DigestEncoding::Hex,
            prefix: "sha256=".to_owned(),
        };

        let stripe_request = SignedRequest {
            headers: &stripe_headers,
            body: BODY,
        };
        let hmac_request = SignedRequest {
            headers: &hmac_headers,
            body: BODY,
        };

        assert_eq!(
            verify_signature(
                &SignatureScheme::Stripe,
                stripe_secret,
                &stripe_request,
                NOW,
                300
            ),
            Ok(())
        );
        assert_eq!(
            verify_signature(&hmac_scheme, "shop-secret", &hmac_request, NOW, 300),
            Ok(())
        );
        assert!(verify_signature(&hmac_scheme, "other-secret", &hmac_request, NOW, 300).is_err());
    }
}
