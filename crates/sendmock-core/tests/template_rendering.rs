//! Rendering modes, problems with their positions, and the engine's limits.

use std::sync::Arc;

use sendmock_core::{
    FixedClock, RenderedTemplate, SeededRandomSource, StandardTemplateFunctions, TemplateEscape,
    TemplateProblemSeverity, TemplateRenderMode, render_template_in_mode,
};
use serde_json::{Value, json};

fn render(
    template_text: &str,
    escape: TemplateEscape,
    render_mode: TemplateRenderMode,
) -> RenderedTemplate {
    let template_functions = StandardTemplateFunctions::new(
        Arc::new(FixedClock::new(1_767_225_600_000)),
        Arc::new(SeededRandomSource::new(1)),
    );
    let template_context = json!({
        "message": { "to": "+1 555", "items": [{ "code": "AB" }], "body": "Say \"hi\"\n", "tags": ["a"] },
        "data": { "to": [{ "address": "ann@example.com" }, { "address": "bob@example.com" }], "subject": null },
    });
    render_template_in_mode(
        template_text,
        &template_context,
        &template_functions,
        escape,
        render_mode,
    )
}

fn render_lenient(template_text: &str) -> RenderedTemplate {
    render(
        template_text,
        TemplateEscape::None,
        TemplateRenderMode::Lenient,
    )
}

fn render_strict(template_text: &str) -> RenderedTemplate {
    render(
        template_text,
        TemplateEscape::None,
        TemplateRenderMode::Strict,
    )
}

fn problem_summaries(
    rendered: &RenderedTemplate,
) -> Vec<(
    TemplateProblemSeverity,
    String,
    Option<usize>,
    Option<usize>,
)> {
    rendered
        .problems
        .iter()
        .map(|problem| {
            (
                problem.severity,
                problem.message.clone(),
                problem.line,
                problem.column,
            )
        })
        .collect()
}

#[test]
fn paths_filters_and_defaults_render_like_the_preview() {
    let rendered = render_lenient(
        r#"to={{ message.to | urlencode }} code={{ message.items[0].code | lower }} via={{ message.via | default("sms") }}"#,
    );

    assert_eq!(rendered.text, "to=%2B1%20555 code=ab via=sms");
    assert!(rendered.problems.is_empty());
}

#[test]
fn json_strings_are_escaped_but_the_json_filters_are_not() {
    let rendered = render(
        r#"{"body": "{{ message.body }}", "tags": {{ message.tags | json }}, "first": {{ message.tags | first | tojson }}}"#,
        TemplateEscape::JsonString,
        TemplateRenderMode::Lenient,
    );

    assert_eq!(
        serde_json::from_str::<Value>(&rendered.text).ok(),
        Some(json!({ "body": "Say \"hi\"\n", "tags": ["a"], "first": "a" }))
    );
}

#[test]
fn unknown_names_are_errors_and_missing_values_are_warnings_at_their_place() {
    let rendered = render_lenient("{{ nope }}\n {{ shout() }} {{ \"x\" | sparkle }} {{ open");

    assert_eq!(
        problem_summaries(&rendered),
        vec![
            (
                TemplateProblemSeverity::Error,
                "Unknown function: shout".to_owned(),
                Some(2),
                Some(2)
            ),
            (
                TemplateProblemSeverity::Error,
                "Unknown filter: sparkle".to_owned(),
                Some(2),
                Some(16)
            ),
            (
                TemplateProblemSeverity::Error,
                "Unbalanced {{ }}: every {{ needs a matching }}".to_owned(),
                Some(2),
                Some(36),
            ),
            (
                TemplateProblemSeverity::Warning,
                "Undefined variable: nope".to_owned(),
                Some(1),
                Some(1)
            ),
        ]
    );
}

// AC: WH-07.5
#[test]
fn lenient_mode_renders_missing_values_empty_with_a_warning() {
    let rendered = render_lenient("[{{ data.subjet }}][{{ data.subject }}][{{ data.a.b.c }}]");

    assert_eq!(rendered.text, "[][][]");
    let warnings: Vec<String> = rendered
        .problems
        .iter()
        .map(|problem| problem.message.clone())
        .collect();
    assert_eq!(
        warnings,
        vec![
            "Undefined variable: data.subjet",
            "Undefined variable: data.subject",
            "Undefined variable: data.a.b.c"
        ]
    );
    assert!(!rendered.has_errors());
}

// AC: WH-07.5
#[test]
fn strict_mode_stops_on_a_missing_value_and_names_it() {
    let rendered = render_strict("line one\n  {{ data.subjet }}");

    assert_eq!(rendered.text, "");
    assert_eq!(
        problem_summaries(&rendered),
        vec![(
            TemplateProblemSeverity::Error,
            "Undefined variable: data.subjet".to_owned(),
            Some(2),
            Some(6)
        )]
    );
}

// AC: WH-07.5
#[test]
fn strict_mode_allows_checks_defaults_and_loops() {
    let rendered = render_strict(
        "{% if data.missing %}x{% endif %}{{ data.missing | default('none') }}:{% for recipient in data.to %}{{ recipient.address }},{% endfor %}",
    );

    assert_eq!(rendered.text, "none:ann@example.com,bob@example.com,");
    assert!(rendered.problems.is_empty());
}

// AC: WH-07.5
#[test]
fn a_required_value_that_is_empty_fails_the_render() {
    let rendered = render_lenient("{{ data.subject | required }}");

    assert_eq!(rendered.text, "");
    assert_eq!(rendered.problems[0].message, "A required value is empty");
    assert!(rendered.has_errors());
}

// AC: WH-07.7
#[test]
fn a_runaway_template_runs_out_of_fuel() {
    let rendered = render_lenient(
        "{% for i in range(10000) %}{% for j in range(10000) %}{% endfor %}{% endfor %}",
    );

    assert_eq!(
        rendered.problems[0].message,
        "The template ran too long and was stopped"
    );
}

// AC: WH-07.7
#[test]
fn rendered_text_is_capped_at_one_megabyte() {
    let rendered = render_lenient("{{ 'x' * 2000000 }}");

    assert_eq!(rendered.text, "");
    assert_eq!(
        rendered.problems[0].message,
        "The rendered text is over 1 MB"
    );
}

// AC: WH-07.7
#[test]
fn templates_cannot_read_files_or_the_environment() {
    let included = render_lenient("{% include '/etc/passwd' %}");
    let environment_lookup = render_strict("{{ env.HOME }}{{ environ }}");

    assert_eq!(included.text, "");
    assert!(included.has_errors());
    assert_eq!(environment_lookup.text, "");
    assert!(environment_lookup.has_errors());
}
