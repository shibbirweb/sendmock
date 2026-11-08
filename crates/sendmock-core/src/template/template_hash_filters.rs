//! Hashing and signing filters: `md5`, `sha1`, `sha256`, `sha512`, `hmac_sha256(key)` and
//! `hmac_sha1(key)`, written as lowercase hex (or Base64 with `encoding="base64"` on the HMACs).

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use hmac::{Hmac, KeyInit, Mac};
use md5::Md5;
use minijinja::value::Kwargs;
use minijinja::{Error, ErrorKind, Value};
use sha1::Sha1;
use sha2::{Digest, Sha256, Sha512};

use super::template_encoding_filters::to_display_text;

fn write_hex(digest_bytes: &[u8]) -> String {
    digest_bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub fn md5_filter(value: Value) -> String {
    write_hex(&Md5::digest(to_display_text(&value).as_bytes()))
}

pub fn sha1_filter(value: Value) -> String {
    write_hex(&Sha1::digest(to_display_text(&value).as_bytes()))
}

pub fn sha256_filter(value: Value) -> String {
    write_hex(&Sha256::digest(to_display_text(&value).as_bytes()))
}

pub fn sha512_filter(value: Value) -> String {
    write_hex(&Sha512::digest(to_display_text(&value).as_bytes()))
}

fn write_signature(signature_bytes: &[u8], keyword_arguments: &Kwargs) -> Result<String, Error> {
    let encoding: Option<String> = keyword_arguments.get("encoding")?;
    keyword_arguments.assert_all_used()?;
    match encoding.as_deref() {
        None | Some("hex") => Ok(write_hex(signature_bytes)),
        Some("base64") => Ok(STANDARD.encode(signature_bytes)),
        Some(other_encoding) => Err(Error::new(
            ErrorKind::InvalidOperation,
            format!("Unknown encoding {other_encoding}: use hex or base64"),
        )),
    }
}

fn invalid_key_error() -> Error {
    Error::new(ErrorKind::InvalidOperation, "The HMAC key cannot be used")
}

pub fn hmac_sha256_filter(
    value: Value,
    key: String,
    keyword_arguments: Kwargs,
) -> Result<String, Error> {
    let mut mac = <Hmac<Sha256> as KeyInit>::new_from_slice(key.as_bytes())
        .map_err(|_| invalid_key_error())?;
    mac.update(to_display_text(&value).as_bytes());
    write_signature(&mac.finalize().into_bytes(), &keyword_arguments)
}

pub fn hmac_sha1_filter(
    value: Value,
    key: String,
    keyword_arguments: Kwargs,
) -> Result<String, Error> {
    let mut mac =
        <Hmac<Sha1> as KeyInit>::new_from_slice(key.as_bytes()).map_err(|_| invalid_key_error())?;
    mac.update(to_display_text(&value).as_bytes());
    write_signature(&mac.finalize().into_bytes(), &keyword_arguments)
}
