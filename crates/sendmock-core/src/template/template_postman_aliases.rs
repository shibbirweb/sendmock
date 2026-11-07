//! Postman's dynamic variables (`{{$randomUUID}}`, `{{$timestamp}}`, ...) rewritten to the
//! equivalent SendMock functions before rendering, for people bringing Postman requests over.

use std::borrow::Cow;
use std::sync::LazyLock;

use regex::Regex;

static POSTMAN_ALIAS_PATTERN: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"\{\{\s*\$([A-Za-z]+)\s*\}\}").ok());

/// Each Postman name and the expression it stands for.
pub const POSTMAN_ALIASES: &[(&str, &str)] = &[
    ("guid", "uuid()"),
    ("randomUUID", "uuid()"),
    ("timestamp", "timestamp()"),
    ("isoTimestamp", "now_iso()"),
    ("randomInt", "random_int(0, 1000)"),
    ("randomBoolean", "random_bool()"),
    ("randomAlphaNumeric", "random_string(1)"),
    ("randomHexadecimal", "random_hex(1)"),
    ("randomPhoneNumber", "random_phone()"),
    ("randomEmail", "fake.email()"),
    ("randomExampleEmail", "fake.email()"),
    ("randomUserName", "fake.username()"),
    ("randomFirstName", "fake.first_name()"),
    ("randomLastName", "fake.last_name()"),
    ("randomFullName", "fake.name()"),
    ("randomCompanyName", "fake.company()"),
    ("randomCity", "fake.city()"),
    ("randomStreetAddress", "fake.address()"),
    ("randomCountryCode", "fake.country_code()"),
    ("randomIP", "fake.ip()"),
    ("randomUserAgent", "fake.user_agent()"),
    ("randomUrl", "fake.url()"),
    ("randomWord", "fake.word()"),
    ("randomLoremWord", "fake.word()"),
    ("randomLoremSentence", "fake.sentence()"),
    ("randomLoremParagraph", "fake.paragraph()"),
];

/// The template with every known Postman alias replaced; unknown ones are left as written, so
/// the render reports them.
pub fn rewrite_postman_aliases(template_text: &str) -> Cow<'_, str> {
    let Some(alias_pattern) = POSTMAN_ALIAS_PATTERN.as_ref() else {
        return Cow::Borrowed(template_text);
    };
    alias_pattern.replace_all(template_text, |alias_captures: &regex::Captures| {
        let alias_name = &alias_captures[1];
        POSTMAN_ALIASES
            .iter()
            .find(|(postman_name, _)| *postman_name == alias_name)
            .map_or_else(
                || alias_captures[0].to_owned(),
                |(_, expression)| format!("{{{{ {expression} }}}}"),
            )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_aliases_become_functions_and_unknown_ones_stay() {
        assert_eq!(
            rewrite_postman_aliases(
                r#"{"id": "{{$randomUUID}}", "at": {{ $timestamp }}, "x": "{{$nope}}"}"#
            ),
            r#"{"id": "{{ uuid() }}", "at": {{ timestamp() }}, "x": "{{$nope}}"}"#
        );
    }

    #[test]
    fn a_template_without_aliases_is_left_as_it_is() {
        assert!(matches!(
            rewrite_postman_aliases("{{ data.subject }}"),
            Cow::Borrowed(_)
        ));
    }
}
