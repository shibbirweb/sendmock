//! What each of SendMock's template filters does, for the template filter reference page.

/// One filter as the reference documents it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TemplateFilterEntry {
    pub name: &'static str,
    /// The filter as written in a template, with its arguments.
    pub usage: &'static str,
    pub description: &'static str,
}

const fn entry(
    name: &'static str,
    usage: &'static str,
    description: &'static str,
) -> TemplateFilterEntry {
    TemplateFilterEntry {
        name,
        usage,
        description,
    }
}

/// Every filter in `SENDMOCK_FILTER_NAMES`, in the same order.
pub const TEMPLATE_FILTER_CATALOGUE: &[TemplateFilterEntry] = &[
    entry(
        "default",
        "value | default(fallback)",
        "The fallback when the value is missing, null or empty.",
    ),
    entry("d", "value | d(fallback)", "Short for `default`."),
    entry(
        "required",
        "value | required(message)",
        "Stops the render with the message when the value is missing, null or empty.",
    ),
    entry(
        "capitalize",
        "text | capitalize",
        "The first character in upper case and the rest in lower case.",
    ),
    entry(
        "squish",
        "text | squish",
        "Every run of whitespace collapsed into one space, with the ends trimmed.",
    ),
    entry(
        "truncate",
        "text | truncate(length, end=\"...\")",
        "The first `length` characters, followed by `end` when the text was cut.",
    ),
    entry(
        "slice",
        "value | slice(start, end)",
        "Characters or list items from `start` up to `end` (excluded); negative indexes count from the end.",
    ),
    entry(
        "regex_replace",
        "text | regex_replace(pattern, replacement)",
        "Every match of the regular expression replaced; `$1` or `${name}` in the replacement inserts a capture.",
    ),
    entry(
        "regex_extract",
        "text | regex_extract(pattern, group)",
        "The match of the regular expression, or its capture `group`; empty when nothing matches.",
    ),
    entry(
        "contains",
        "value | contains(item)",
        "Whether a text contains a piece of text, or a list contains an item.",
    ),
    entry(
        "slugify",
        "text | slugify",
        "Lowercase ASCII words joined by `-`: `Hello, World!` becomes `hello-world`.",
    ),
    entry(
        "pad_left",
        "text | pad_left(width, character)",
        "The text padded on the left to `width` characters, with spaces or the given character.",
    ),
    entry(
        "pad_right",
        "text | pad_right(width, character)",
        "The text padded on the right to `width` characters, with spaces or the given character.",
    ),
    entry(
        "number_format",
        "number | number_format(decimals)",
        "The number with `decimals` places and `,` between thousands: `1234.5` becomes `1,234.50`.",
    ),
    entry(
        "date",
        "time | date(format, tz=\"UTC\")",
        "The time written with a `strftime` format (default `%Y-%m-%dT%H:%M:%SZ`) in a time zone (default UTC).",
    ),
    entry(
        "date_add",
        "time | date_add(seconds)",
        "The time `seconds` later, or earlier when negative, as an RFC 3339 timestamp.",
    ),
    entry("unix", "time | unix", "The time as Unix seconds."),
    entry(
        "e164",
        "phone | e164",
        "The number without spaces, dashes, dots or brackets, a leading `00` turned into `+`.",
    ),
    entry(
        "phone_country",
        "phone | phone_country",
        "The ISO country code of an international number, or an empty string.",
    ),
    entry(
        "phone_national",
        "phone | phone_national",
        "The digits after the calling code, or every digit when the country is unknown.",
    ),
    entry(
        "urlencode",
        "value | urlencode",
        "Percent-encoded as JavaScript's `encodeURIComponent` does.",
    ),
    entry(
        "base64_encode",
        "value | base64_encode",
        "The text encoded as standard Base64.",
    ),
    entry(
        "base64_decode",
        "text | base64_decode",
        "Standard Base64 decoded back to text.",
    ),
    entry(
        "hex_encode",
        "value | hex_encode",
        "The text's bytes as lowercase hexadecimal.",
    ),
    entry(
        "escape_html",
        "value | escape_html",
        "`&`, `<`, `>`, `\"` and `'` escaped for HTML.",
    ),
    entry(
        "strip_html",
        "value | strip_html",
        "The text with HTML tags removed.",
    ),
    entry(
        "json",
        "value | json",
        "The value as indented JSON, written as it is even inside a JSON string.",
    ),
    entry(
        "tojson",
        "value | tojson",
        "The value as compact JSON (a string gets its quotes), written as it is.",
    ),
    entry(
        "fromjson",
        "text | fromjson",
        "JSON text parsed into a value, so its fields can be read.",
    ),
    entry(
        "pick",
        "object | pick(\"key\", ...)",
        "The object with only the named keys.",
    ),
    entry(
        "omit",
        "object | omit(\"key\", ...)",
        "The object without the named keys.",
    ),
    entry(
        "md5",
        "value | md5",
        "The MD5 digest as lowercase hexadecimal.",
    ),
    entry(
        "sha1",
        "value | sha1",
        "The SHA-1 digest as lowercase hexadecimal.",
    ),
    entry(
        "sha256",
        "value | sha256",
        "The SHA-256 digest as lowercase hexadecimal.",
    ),
    entry(
        "sha512",
        "value | sha512",
        "The SHA-512 digest as lowercase hexadecimal.",
    ),
    entry(
        "hmac_sha256",
        "value | hmac_sha256(key, encoding=\"hex\")",
        "The HMAC-SHA256 of the value with the key, as `hex` (default) or `base64`, for provider signatures.",
    ),
    entry(
        "hmac_sha1",
        "value | hmac_sha1(key, encoding=\"hex\")",
        "The HMAC-SHA1 of the value with the key, as `hex` (default) or `base64`.",
    ),
    entry(
        "sendgrid_event",
        "event.type | sendgrid_event",
        "SendGrid's name for an email event, such as `bounce` for `email.bounced`.",
    ),
    entry(
        "ses_type",
        "event.type | ses_type",
        "Amazon SES's notification type for an email event, such as `Bounce`.",
    ),
    entry(
        "resend_type",
        "event.type | resend_type",
        "Resend's event type for an email event, such as `email.bounced`.",
    ),
    entry(
        "mailgun_event",
        "event.type | mailgun_event",
        "Mailgun's event name for an email event, such as `failed`.",
    ),
    entry(
        "postmark_record_type",
        "event.type | postmark_record_type",
        "Postmark's record type for an email event, such as `Bounce`.",
    ),
    entry(
        "brevo_event",
        "event.type | brevo_event",
        "Brevo's event name for an email event, such as `hard_bounce`.",
    ),
    entry(
        "payment_event",
        "event.type | payment_event(\"stripe\")",
        "The payment provider's name for a payment event, or the native name when it has none.",
    ),
];

#[cfg(test)]
mod tests {
    use super::*;
    use crate::template::SENDMOCK_FILTER_NAMES;

    #[test]
    fn every_sendmock_filter_is_documented_once_and_nothing_else() {
        let documented_names: Vec<&str> = TEMPLATE_FILTER_CATALOGUE
            .iter()
            .map(|filter_entry| filter_entry.name)
            .collect();

        assert_eq!(documented_names, SENDMOCK_FILTER_NAMES);
    }

    #[test]
    fn every_usage_applies_its_own_filter() {
        for filter_entry in TEMPLATE_FILTER_CATALOGUE {
            assert!(
                filter_entry
                    .usage
                    .contains(&format!("| {}", filter_entry.name)),
                "{} usage: {}",
                filter_entry.name,
                filter_entry.usage
            );
        }
    }
}
