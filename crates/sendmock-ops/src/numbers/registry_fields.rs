use crate::OperationError;

const HTTP_URL_MESSAGE: &str = "Enter an http:// or https:// URL";
/// The REST API cannot tell the UI, CLI and agents apart yet.
pub const CREATED_THROUGH_API: &str = "api";

pub fn field_error(field_name: &str, message: &str) -> OperationError {
    OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(field_name.to_owned()),
    }
}

/// `+` and 7 to 15 digits, not starting with zero.
pub fn is_e164(number: &str) -> bool {
    let Some(digits) = number.strip_prefix('+') else {
        return false;
    };
    (7..=15).contains(&digits.len())
        && digits.chars().all(|character| character.is_ascii_digit())
        && !digits.starts_with('0')
}

/// An absolute `http` or `https` URL with a host.
pub fn is_http_url(url_text: &str) -> bool {
    let lowercase_url = url_text.to_ascii_lowercase();
    let after_scheme = lowercase_url
        .strip_prefix("http://")
        .or_else(|| lowercase_url.strip_prefix("https://"));
    after_scheme.is_some_and(|rest| {
        let host = rest.split(['/', '?', '#']).next().unwrap_or_default();
        !host.is_empty() && !rest.contains(char::is_whitespace)
    })
}

/// Blank means none; anything else must be an http(s) URL.
pub fn read_optional_url(
    field_name: &str,
    url_text: Option<String>,
) -> Result<Option<String>, OperationError> {
    match url_text.map(|url_text| url_text.trim().to_owned()) {
        Some(url_text) if url_text.is_empty() => Ok(None),
        Some(url_text) if !is_http_url(&url_text) => Err(field_error(field_name, HTTP_URL_MESSAGE)),
        url_text => Ok(url_text),
    }
}

/// Trimmed text, or `None` when it is blank.
pub fn read_optional_text(text: Option<String>) -> Option<String> {
    text.map(|text| text.trim().to_owned())
        .filter(|text| !text.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn e164_needs_a_plus_and_7_to_15_digits() {
        assert!(is_e164("+15550001111"));
        assert!(is_e164("+8801700000000"));
        assert!(!is_e164("15550001111"));
        assert!(!is_e164("+0555000111"));
        assert!(!is_e164("+1555"));
        assert!(!is_e164("+1555-000-1111"));
    }

    #[test]
    fn webhook_urls_are_absolute_http_or_https() {
        assert!(is_http_url("http://localhost:3000/sms/inbound"));
        assert!(is_http_url("HTTPS://app.test/hook?x=1"));
        assert!(!is_http_url("ftp://app.test"));
        assert!(!is_http_url("http://"));
        assert!(!is_http_url("/sms/inbound"));
        assert!(!is_http_url("http://app.test/a b"));
    }
}
