use serde_json::Value;

use super::template_expression::{EvaluatedValue, ExpressionEvaluator, ExpressionProblem, to_text};
use super::template_functions::TemplateFunctions;

const EXPRESSION_START: &str = "{{";
const EXPRESSION_END: &str = "}}";

/// How rendered values are written: as they are, or escaped for a place inside a JSON string,
/// so a message body with quotes keeps a JSON answer valid.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TemplateEscape {
    None,
    JsonString,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TemplateProblemSeverity {
    /// An undefined value; it renders empty.
    Warning,
    /// An unknown function or filter, or unbalanced braces; saving is refused.
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateProblem {
    pub severity: TemplateProblemSeverity,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderedTemplate {
    pub text: String,
    pub problems: Vec<TemplateProblem>,
}

/// Renders `{{ ... }}` expressions leniently, as the UI preview does: an undefined value renders
/// empty with a warning; unknown names and a `{{` without `}}` are errors. A lone `}}` is text.
pub fn render_template(
    template_text: &str,
    template_context: &Value,
    template_functions: &dyn TemplateFunctions,
    escape: TemplateEscape,
) -> RenderedTemplate {
    let mut evaluator = ExpressionEvaluator {
        template_context,
        template_functions,
        problems: Vec::new(),
    };
    let mut rendered_text = String::with_capacity(template_text.len());
    let mut remaining_text = template_text;
    let mut has_unbalanced_brace = false;
    while let Some(start_index) = remaining_text.find(EXPRESSION_START) {
        rendered_text.push_str(&remaining_text[..start_index]);
        let after_start = &remaining_text[start_index + EXPRESSION_START.len()..];
        let Some(end_index) = after_start.find(EXPRESSION_END) else {
            has_unbalanced_brace = true;
            rendered_text.push_str(&remaining_text[start_index..]);
            remaining_text = "";
            break;
        };
        let evaluated_value = evaluator.evaluate(after_start[..end_index].trim());
        rendered_text.push_str(&write_value(evaluated_value, escape));
        remaining_text = &after_start[end_index + EXPRESSION_END.len()..];
    }
    rendered_text.push_str(remaining_text);
    RenderedTemplate {
        text: rendered_text,
        problems: describe_problems(evaluator.problems, has_unbalanced_brace),
    }
}

fn write_value(evaluated_value: EvaluatedValue, escape: TemplateEscape) -> String {
    match (evaluated_value, escape) {
        (EvaluatedValue::Missing, _) => String::new(),
        (EvaluatedValue::Verbatim(text), _) => text,
        (EvaluatedValue::Value(value), TemplateEscape::None) => to_text(&value),
        (EvaluatedValue::Value(value), TemplateEscape::JsonString) => {
            let quoted_text = Value::from(to_text(&value)).to_string();
            quoted_text[1..quoted_text.len() - 1].to_owned()
        }
    }
}

fn describe_problems(
    expression_problems: Vec<ExpressionProblem>,
    has_unbalanced_brace: bool,
) -> Vec<TemplateProblem> {
    let mut problems: Vec<TemplateProblem> = Vec::new();
    let unbalanced_problem = has_unbalanced_brace.then(|| {
        (
            TemplateProblemSeverity::Error,
            "Unbalanced {{ }}: every {{ needs a matching }}".to_owned(),
        )
    });
    let described_problems = expression_problems
        .into_iter()
        .map(|expression_problem| match expression_problem {
            ExpressionProblem::UnknownFunction(name) => (
                TemplateProblemSeverity::Error,
                format!("Unknown function: {name}"),
            ),
            ExpressionProblem::UnknownFilter(name) => (
                TemplateProblemSeverity::Error,
                format!("Unknown filter: {name}"),
            ),
            ExpressionProblem::UndefinedVariable(path) => (
                TemplateProblemSeverity::Warning,
                format!("Undefined variable: {path}"),
            ),
        })
        .chain(unbalanced_problem);
    for (severity, message) in described_problems {
        if !problems.iter().any(|problem| problem.message == message) {
            problems.push(TemplateProblem { severity, message });
        }
    }
    problems
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use serde_json::json;

    use super::*;
    use crate::{FixedClock, SeededRandomSource, StandardTemplateFunctions};

    fn render(
        template_text: &str,
        template_context: &Value,
        escape: TemplateEscape,
    ) -> RenderedTemplate {
        let template_functions = StandardTemplateFunctions::new(
            Arc::new(FixedClock::new(1_767_225_600_000)),
            Arc::new(SeededRandomSource::new(1)),
        );
        render_template(template_text, template_context, &template_functions, escape)
    }

    #[test]
    fn paths_filters_and_defaults_render_like_the_preview() {
        let template_context =
            json!({ "message": { "to": "+1 555", "items": [{ "code": "AB" }] } });

        let rendered = render(
            r#"to={{ message.to | urlencode }} code={{ message.items[0].code | lower }} via={{ message.via | default("sms") }}"#,
            &template_context,
            TemplateEscape::None,
        );

        assert_eq!(rendered.text, "to=%2B1%20555 code=ab via=sms");
        assert!(rendered.problems.is_empty());
    }

    #[test]
    fn json_strings_are_escaped_but_the_json_filter_is_not() {
        let template_context = json!({ "message": { "body": "Say \"hi\"\n", "tags": ["a"] } });

        let rendered = render(
            r#"{"body": "{{ message.body }}", "tags": {{ message.tags | json }}}"#,
            &template_context,
            TemplateEscape::JsonString,
        );

        assert_eq!(
            serde_json::from_str::<Value>(&rendered.text).ok(),
            Some(json!({ "body": "Say \"hi\"\n", "tags": ["a"] }))
        );
    }

    #[test]
    fn unknown_names_are_errors_and_missing_values_are_warnings() {
        let rendered = render(
            "{{ nope }} {{ shout() }} {{ \"x\" | sparkle }} {{ open",
            &json!({}),
            TemplateEscape::None,
        );
        let messages: Vec<(TemplateProblemSeverity, &str)> = rendered
            .problems
            .iter()
            .map(|problem| (problem.severity, problem.message.as_str()))
            .collect();

        assert_eq!(
            messages,
            vec![
                (TemplateProblemSeverity::Warning, "Undefined variable: nope"),
                (TemplateProblemSeverity::Error, "Unknown function: shout"),
                (TemplateProblemSeverity::Error, "Unknown filter: sparkle"),
                (
                    TemplateProblemSeverity::Error,
                    "Unbalanced {{ }}: every {{ needs a matching }}"
                ),
            ]
        );
    }

    #[test]
    fn functions_take_literal_arguments() {
        let rendered = render("SM{{ random_hex(32) }}", &json!({}), TemplateEscape::None);

        assert_eq!(rendered.text.len(), 34);
        assert!(rendered.problems.is_empty());
    }
}
