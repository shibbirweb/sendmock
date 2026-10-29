//! Every documented filter returns the documented output (WH-07.3), checked through a render.

use std::sync::Arc;

use sendmock_core::{
    FixedClock, SeededRandomSource, StandardTemplateFunctions, TemplateEscape,
    TemplateProblemSeverity, render_template,
};
use serde_json::{Value, json};

fn render_text(template_text: &str) -> String {
    let template_functions = StandardTemplateFunctions::new(
        Arc::new(FixedClock::new(1_767_225_600_000)),
        Arc::new(SeededRandomSource::new(1)),
    );
    let template_context = json!({
        "data": {
            "subject": "  Hello,   World!  ",
            "to": [{ "address": "Ann@Example.com" }, { "address": "bob@example.com" }],
            "html": "<p>Hi <b>there</b></p>",
            "amount": 1234.5,
            "meta": { "env": "local", "tenant": "acme", "secret": "x" },
            "sent_at": "2026-01-01T00:00:00Z",
            "phone": "+44 20 7946 0000",
        },
    });
    let rendered = render_template(
        template_text,
        &template_context,
        &template_functions,
        TemplateEscape::None,
    );
    let errors: Vec<&str> = rendered
        .problems
        .iter()
        .filter(|problem| problem.severity == TemplateProblemSeverity::Error)
        .map(|problem| problem.message.as_str())
        .collect();
    assert!(errors.is_empty(), "{template_text}: {errors:?}");
    rendered.text
}

fn assert_renders(cases: &[(&str, &str)]) {
    for (template_text, expected_text) in cases {
        assert_eq!(
            &render_text(template_text),
            expected_text,
            "{template_text}"
        );
    }
}

// AC: WH-07.3
#[test]
fn case_whitespace_and_length_filters() {
    assert_renders(&[
        ("{{ 'ann' | upper }}", "ANN"),
        ("{{ 'ANN' | lower }}", "ann"),
        ("{{ 'hello world' | title }}", "Hello World"),
        ("{{ 'hELLO' | capitalize }}", "Hello"),
        ("{{ data.subject | trim }}", "Hello,   World!"),
        ("{{ data.subject | squish }}", "Hello, World!"),
        ("{{ 'abcdef' | truncate(3) }}", "abc..."),
        ("{{ 'abcdef' | truncate(3, end='~') }}", "abc~"),
        ("{{ 'abc' | truncate(5) }}", "abc"),
        ("{{ data.to | length }}", "2"),
        ("{{ data.to | first | attr('address') }}", "Ann@Example.com"),
        ("{{ (data.to | last).address }}", "bob@example.com"),
        ("{{ 'abcdef' | slice(1, 3) }}", "bc"),
        ("{{ 'abcdef' | slice(-2) }}", "ef"),
        ("{{ [1, 2, 3] | slice(0, 2) | join(',') }}", "1,2"),
    ]);
}

// AC: WH-07.3
#[test]
fn replace_match_and_default_filters() {
    assert_renders(&[
        ("{{ 'a-b-c' | replace('-', '+') }}", "a+b+c"),
        (
            "{{ 'Order 123 and 456' | regex_replace('[0-9]+', '#') }}",
            "Order # and #",
        ),
        (
            "{{ 'Your code is 482913' | regex_extract('[0-9]{6}') }}",
            "482913",
        ),
        ("{{ 'id=42;' | regex_extract('id=([0-9]+)', 1) }}", "42"),
        ("{{ 'nothing' | regex_extract('[0-9]+') }}", ""),
        ("{{ 'hello' | contains('ell') }}", "true"),
        ("{{ ['a', 'b'] | contains('c') }}", "false"),
        ("{{ data.missing | default('none') }}", "none"),
        ("{{ '' | default('empty') }}", "empty"),
        ("{{ 'kept' | default('x') }}", "kept"),
        ("{{ 'set' | required }}", "set"),
    ]);
}

// AC: WH-07.3
#[test]
fn formatting_filters() {
    assert_renders(&[
        ("{{ 'Hello, World!' | slugify }}", "hello-world"),
        ("{{ '7' | pad_left(3, '0') }}", "007"),
        ("{{ 'ab' | pad_right(4, '.') }}", "ab.."),
        ("{{ data.amount | number_format(2) }}", "1,234.50"),
        ("{{ 1000000 | number_format }}", "1,000,000"),
        ("{{ -1234.567 | number_format(1) }}", "-1,234.6"),
    ]);
}

// AC: WH-07.3
#[test]
fn encoding_filters() {
    assert_renders(&[
        ("{{ 'a b&c=d/é' | urlencode }}", "a%20b%26c%3Dd%2F%C3%A9"),
        ("{{ 'hello' | base64_encode }}", "aGVsbG8="),
        ("{{ 'aGVsbG8=' | base64_decode }}", "hello"),
        ("{{ 'hi' | hex_encode }}", "6869"),
        (
            "{{ '<a href=\"x\">' | escape_html }}",
            "&lt;a href=&quot;x&quot;&gt;",
        ),
        ("{{ data.html | strip_html }}", "Hi there"),
    ]);
}

// AC: WH-07.3
#[test]
fn json_filters() {
    assert_renders(&[
        (
            "{{ data.meta | pick('env', 'tenant') | tojson }}",
            r#"{"env":"local","tenant":"acme"}"#,
        ),
        (
            "{{ data.meta | omit('secret') | tojson }}",
            r#"{"env":"local","tenant":"acme"}"#,
        ),
        ("{{ 'say \"hi\"' | tojson }}", r#""say \"hi\"""#),
        ("{{ ('{\"a\": [1, 2]}' | fromjson).a | join('+') }}", "1+2"),
        ("{{ [1] | json }}", "[\n  1\n]"),
    ]);
}

// AC: WH-07.3
#[test]
fn hashing_and_signing_filters() {
    assert_renders(&[
        ("{{ 'abc' | md5 }}", "900150983cd24fb0d6963f7d28e17f72"),
        (
            "{{ 'abc' | sha1 }}",
            "a9993e364706816aba3e25717850c26c9cd0d89d",
        ),
        (
            "{{ 'abc' | sha256 }}",
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        ),
        (
            "{{ 'abc' | sha512 | truncate(16, end='') }}",
            "ddaf35a193617aba",
        ),
        (
            "{{ 'The quick brown fox jumps over the lazy dog' | hmac_sha256('key') }}",
            "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
        ),
        (
            "{{ 'The quick brown fox jumps over the lazy dog' | hmac_sha1('key') }}",
            "de7c9b85b8b78aa6bc8a7a36f70a90701c9db4d9",
        ),
        (
            "{{ 'The quick brown fox jumps over the lazy dog' | hmac_sha1('key', encoding='base64') }}",
            "3nybhbi3iqa8ino29wqQcBydtNk=",
        ),
    ]);
}

// AC: WH-07.3
#[test]
fn date_filters() {
    assert_renders(&[
        ("{{ data.sent_at | date }}", "2026-01-01T00:00:00Z"),
        (
            "{{ data.sent_at | date('%d/%m/%Y %H:%M') }}",
            "01/01/2026 00:00",
        ),
        ("{{ data.sent_at | date('%H:%M', tz='+05:30') }}", "05:30"),
        ("{{ 1767225600 | date('%Y') }}", "2026"),
        ("{{ data.sent_at | date_add(90) }}", "2026-01-01T00:01:30Z"),
        ("{{ data.sent_at | unix }}", "1767225600"),
        ("{{ now() | unix }}", "1767225600"),
    ]);
}

// AC: WH-07.3
#[test]
fn list_and_phone_filters() {
    assert_renders(&[
        (
            "{{ data.to | map(attribute='address') | join(', ') }}",
            "Ann@Example.com, bob@example.com",
        ),
        ("{{ [3, 1, 2, 1] | unique | sort | join }}", "123"),
        ("{{ data.phone | e164 }}", "+442079460000"),
        ("{{ data.phone | phone_country }}", "GB"),
        ("{{ data.phone | phone_national }}", "2079460000"),
    ]);
}

// AC: WH-07.3
#[test]
fn functions_render_in_templates() {
    let rendered_text = render_text(
        "{{ uuid() | length }} {{ ulid() | length }} {{ random_int(5, 5) }} {{ timestamp() }} {{ random_otp(4) | length }} {{ random_string(8, charset='hex') | length }}",
    );

    assert_eq!(rendered_text, "36 26 5 1767225600 4 8");
}

// AC: WH-07.3
#[test]
fn every_listed_filter_exists_in_the_engine() {
    let listed_filters = sendmock_core::template::SENDMOCK_FILTER_NAMES
        .iter()
        .chain(sendmock_core::template::BUILTIN_FILTER_NAMES);
    for filter_name in listed_filters {
        let template_functions = StandardTemplateFunctions::new(
            Arc::new(FixedClock::new(0)),
            Arc::new(SeededRandomSource::new(1)),
        );
        let rendered = render_template(
            &format!("{{{{ x | {filter_name} }}}}"),
            &Value::Null,
            &template_functions,
            TemplateEscape::None,
        );
        assert!(
            !rendered
                .problems
                .iter()
                .any(|problem| problem.message.starts_with("Unknown filter")),
            "{filter_name}: {:?}",
            rendered.problems
        );
    }
}
