//! The email providers' own webhook signatures, so an app's check passes with the provider's
//! library: Mailgun's HMAC over timestamp and token, and SendGrid's ECDSA over timestamp and
//! body with SendMock's published test key.

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use hmac::{Hmac, KeyInit, Mac};
use ring::rand::SystemRandom;
use ring::signature::{ECDSA_P256_SHA256_ASN1_SIGNING, EcdsaKeyPair};
use sha2::Sha256;

/// The verification key an app sets for SendMock's signed SendGrid event webhooks: the public
/// half of a test key pair published in the docs, as SendGrid shows its own (base64 DER).
pub const SENDGRID_TEST_VERIFICATION_KEY: &str = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEdZuCtJsfc9vqpbyG5Cknr4QqZWrFTIOUqVuAy9/FtZ3CdY7v0Xd+IwjfbPzxo6nvA60JYfvGMr5ifaJ0Hd5OAA==";

/// The private half (PKCS#8). It signs test traffic only and is public on purpose.
const SENDGRID_TEST_SIGNING_KEY: &str = "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgiNhy/oWDPHUNr3YBUUF45SfUKB4QZ8Gr4kDzBon1LV+hRANCAAR1m4K0mx9z2+qlvIbkKSevhCplasVMg5SpW4DL38W1ncJ1ju/Rd34jCN9s/PGjqe8DrQlh+8YyvmJ9onQd3k4A";

/// Mailgun's webhook `signature`: HMAC-SHA256 of `timestamp` then `token`, keyed by the
/// account's HTTP webhook signing key, in lowercase hex.
pub fn sign_mailgun_token(signing_key: &str, timestamp: &str, token: &str) -> String {
    let Ok(mut mac) = <Hmac<Sha256> as KeyInit>::new_from_slice(signing_key.as_bytes()) else {
        return String::new();
    };
    mac.update(timestamp.as_bytes());
    mac.update(token.as_bytes());
    mac.finalize()
        .into_bytes()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// `X-Twilio-Email-Event-Webhook-Signature`: ECDSA P-256 with SHA-256 over the timestamp
/// header followed by the raw body, ASN.1 DER in base64; empty if the key cannot sign.
pub fn sign_sendgrid_event(timestamp: &str, payload: &str) -> String {
    let random_source = SystemRandom::new();
    let Ok(private_key) = STANDARD.decode(SENDGRID_TEST_SIGNING_KEY) else {
        return String::new();
    };
    let Ok(key_pair) = EcdsaKeyPair::from_pkcs8(
        &ECDSA_P256_SHA256_ASN1_SIGNING,
        &private_key,
        &random_source,
    ) else {
        return String::new();
    };
    let signed_content = format!("{timestamp}{payload}");
    key_pair
        .sign(&random_source, signed_content.as_bytes())
        .map(|signature| STANDARD.encode(signature.as_ref()))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use ring::signature::{ECDSA_P256_SHA256_ASN1, UnparsedPublicKey};

    use super::*;

    #[test]
    fn mailgun_signatures_are_the_hmac_of_timestamp_then_token() {
        // Computed independently with Python's hmac module.
        assert_eq!(
            sign_mailgun_token(
                "key-12345",
                "1529006854",
                "a8ce0edb2dd8301dee6c2405235584e45aa91d1e9f979f3de0"
            ),
            "ad71c2eff31dae8faf3393ff83ccad1809a7d1e7b41af9f951169eab5ddde707"
        );
    }

    #[test]
    fn sendgrid_signatures_verify_with_the_published_key() {
        let payload = r#"[{"email":"sam@example.test","event":"delivered"}]"#;
        let signature = STANDARD
            .decode(sign_sendgrid_event("1767225600", payload))
            .unwrap_or_default();
        let public_key_info = STANDARD
            .decode(SENDGRID_TEST_VERIFICATION_KEY)
            .unwrap_or_default();
        // The last 65 bytes of the SubjectPublicKeyInfo are the uncompressed point ring takes.
        let public_point = &public_key_info[public_key_info.len() - 65..];

        let verification = UnparsedPublicKey::new(&ECDSA_P256_SHA256_ASN1, public_point)
            .verify(format!("1767225600{payload}").as_bytes(), &signature);

        assert!(verification.is_ok());
    }
}
