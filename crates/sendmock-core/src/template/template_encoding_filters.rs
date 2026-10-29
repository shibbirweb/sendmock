//! Encoding and JSON filters: `urlencode`, Base64, hex, HTML, `json`, `tojson`, `fromjson`,
//! `pick` and `omit`.

use std::sync::LazyLock;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use minijinja::value::{Rest, Serde, ValueKind};
use minijinja::{Error, ErrorKind, Value};
use regex::Regex;

static HTML_TAG_PATTERN: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"(?s)<[^>]*>").ok());

/// Text as a template renders it: strings as they are, other values as JSON.
pub fn to_display_text(value: &Value) -> String {
    match value.as_str() {
        Some(text) => text.to_owned(),
        None if value.is_undefined() || value.is_none() => String::new(),
        None => serde_json::to_string(value).unwrap_or_default(),
    }
}

/// Percent-encodes everything but `A-Z a-z 0-9 - _ . ! ~ * ' ( )`, as JavaScript's
/// `encodeURIComponent` does, so form bodies match the UI preview.
pub fn urlencode_filter(value: Value) -> String {
    let mut encoded_text = String::new();
    for byte in to_display_text(&value).bytes() {
        if byte.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&byte) {
            encoded_text.push(char::from(byte));
        } else {
            encoded_text.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded_text
}

pub fn base64_encode_filter(value: Value) -> String {
    STANDARD.encode(to_display_text(&value))
}

pub fn base64_decode_filter(encoded_text: String) -> Result<String, Error> {
    let decoded_bytes = STANDARD
        .decode(encoded_text.trim())
        .map_err(|decode_error| {
            Error::new(
                ErrorKind::InvalidOperation,
                format!("Not valid Base64: {decode_error}"),
            )
        })?;
    Ok(String::from_utf8_lossy(&decoded_bytes).into_owned())
}

pub fn hex_encode_filter(value: Value) -> String {
    to_display_text(&value)
        .bytes()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub fn escape_html_filter(value: Value) -> String {
    let mut escaped_text = String::new();
    for character in to_display_text(&value).chars() {
        match character {
            '&' => escaped_text.push_str("&amp;"),
            '<' => escaped_text.push_str("&lt;"),
            '>' => escaped_text.push_str("&gt;"),
            '"' => escaped_text.push_str("&quot;"),
            '\'' => escaped_text.push_str("&#39;"),
            other_character => escaped_text.push(other_character),
        }
    }
    escaped_text
}

pub fn strip_html_filter(value: Value) -> String {
    let html_text = to_display_text(&value);
    match HTML_TAG_PATTERN.as_ref() {
        Some(tag_pattern) => tag_pattern.replace_all(&html_text, "").into_owned(),
        None => html_text,
    }
}

fn to_json_value(value: &Value) -> serde_json::Value {
    if value.is_undefined() {
        return serde_json::Value::Null;
    }
    serde_json::to_value(value).unwrap_or(serde_json::Value::Null)
}

/// The value as indented JSON, written as it is even inside a JSON string.
pub fn json_filter(value: Value) -> Value {
    Value::from_safe_string(
        serde_json::to_string_pretty(&to_json_value(&value)).unwrap_or_default(),
    )
}

/// The value as compact JSON (a string gets its quotes), written as it is.
pub fn tojson_filter(value: Value) -> Value {
    Value::from_safe_string(serde_json::to_string(&to_json_value(&value)).unwrap_or_default())
}

pub fn fromjson_filter(json_text: String) -> Result<Value, Error> {
    let parsed_value: serde_json::Value =
        serde_json::from_str(&json_text).map_err(|parse_error| {
            Error::new(
                ErrorKind::InvalidOperation,
                format!("Not valid JSON: {parse_error}"),
            )
        })?;
    Ok(Value::from(Serde(parsed_value)))
}

fn filter_object_keys(value: &Value, keys: &[String], should_keep: bool) -> Result<Value, Error> {
    if value.kind() != ValueKind::Map {
        return Err(Error::new(
            ErrorKind::InvalidOperation,
            "pick and omit need an object",
        ));
    }
    let mut kept_entries = serde_json::Map::new();
    for key in value.try_iter()? {
        let key_text = to_display_text(&key);
        if keys.contains(&key_text) == should_keep {
            kept_entries.insert(key_text, to_json_value(&value.get_item(&key)?));
        }
    }
    Ok(Value::from(Serde(serde_json::Value::Object(kept_entries))))
}

/// The object with only the named keys.
pub fn pick_filter(value: Value, keys: Rest<String>) -> Result<Value, Error> {
    filter_object_keys(&value, &keys, true)
}

/// The object without the named keys.
pub fn omit_filter(value: Value, keys: Rest<String>) -> Result<Value, Error> {
    filter_object_keys(&value, &keys, false)
}
