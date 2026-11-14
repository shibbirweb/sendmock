//! The signatures payment providers put on their notifications, computed the way each
//! provider's own libraries check them.

use std::collections::BTreeMap;
use std::fmt::Write;

use hmac::{Hmac, KeyInit, Mac};
use md5::{Digest, Md5};
use sha2::Sha256;

fn write_hex(bytes: &[u8]) -> String {
    bytes.iter().fold(String::new(), |mut hex_text, byte| {
        let _ = write!(hex_text, "{byte:02x}");
        hex_text
    })
}

/// The lowercase hex HMAC-SHA256 of `payload`; empty when the key cannot be used.
fn hmac_sha256_hex(secret: &str, payload: &str) -> String {
    let Ok(mut mac) = <Hmac<Sha256> as KeyInit>::new_from_slice(secret.as_bytes()) else {
        return String::new();
    };
    mac.update(payload.as_bytes());
    write_hex(&mac.finalize().into_bytes())
}

fn md5_hex(text: &str) -> String {
    write_hex(&Md5::digest(text.as_bytes()))
}

/// `Stripe-Signature`: `t=<timestamp>,v1=<HMAC-SHA256 of "<timestamp>.<body>">`, keyed by the
/// endpoint's signing secret.
pub fn sign_stripe_payload(webhook_secret: &str, timestamp_seconds: i64, payload: &str) -> String {
    let signature_hex = hmac_sha256_hex(webhook_secret, &format!("{timestamp_seconds}.{payload}"));
    format!("t={timestamp_seconds},v1={signature_hex}")
}

/// `X-Razorpay-Signature`: the HMAC-SHA256 of the raw body, keyed by the webhook secret.
pub fn sign_razorpay_payload(webhook_secret: &str, payload: &str) -> String {
    hmac_sha256_hex(webhook_secret, payload)
}

/// `Paddle-Signature`: `ts=<timestamp>;h1=<HMAC-SHA256 of "<timestamp>:<body>">`, keyed by the
/// notification destination's secret key.
pub fn sign_paddle_payload(secret_key: &str, timestamp_seconds: i64, payload: &str) -> String {
    let signature_hex = hmac_sha256_hex(secret_key, &format!("{timestamp_seconds}:{payload}"));
    format!("ts={timestamp_seconds};h1={signature_hex}")
}

/// SSLCommerz's `verify_sign`: the MD5 of the fields named in `verify_key` plus `store_passwd`
/// (itself the MD5 of the store password), sorted by name and joined as `name=value&...`.
pub fn sign_sslcommerz_fields(
    store_password: &str,
    signed_fields: &BTreeMap<String, String>,
) -> String {
    let mut hashed_fields = signed_fields.clone();
    hashed_fields.insert("store_passwd".to_owned(), md5_hex(store_password));
    let hash_text = hashed_fields
        .iter()
        .map(|(field_name, field_value)| format!("{field_name}={field_value}"))
        .collect::<Vec<_>>()
        .join("&");
    md5_hex(&hash_text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signs_the_timestamp_and_body_as_stripe_does() {
        assert_eq!(
            sign_stripe_payload("whsec_test", 1_700_000_000, "{}"),
            "t=1700000000,v1=35495024f4ef3f94e5a93e22221544c4b75e9a42300cd965ab81cb85cd994e91"
        );
    }

    #[test]
    fn signs_the_raw_body_as_razorpay_does() {
        assert_eq!(
            sign_razorpay_payload("rzp_secret", r#"{"event":"payment.captured"}"#),
            "0ea09d611215f3d22f53207c37444d3938ba1bd74925b558d3759f86683e48a5"
        );
    }

    #[test]
    fn signs_the_timestamp_and_body_as_paddle_does() {
        assert_eq!(
            sign_paddle_payload(
                "pdl_ntfset_secret",
                1_700_000_000,
                r#"{"event_type":"transaction.completed"}"#
            ),
            "ts=1700000000;h1=b2911e60fc9334358710e70ca418ba1483ae9a054b9a979016216525123a8409"
        );
    }

    #[test]
    fn signs_the_verify_key_fields_as_sslcommerz_does() {
        let signed_fields = BTreeMap::from([
            ("tran_id".to_owned(), "TXN1".to_owned()),
            ("val_id".to_owned(), "VAL1".to_owned()),
            ("amount".to_owned(), "1200.00".to_owned()),
            ("currency".to_owned(), "BDT".to_owned()),
            ("status".to_owned(), "VALID".to_owned()),
        ]);

        assert_eq!(
            sign_sslcommerz_fields("testbox@ssl", &signed_fields),
            "44fd62c8ac77ea7f03a9526172a3dec7"
        );
    }
}
