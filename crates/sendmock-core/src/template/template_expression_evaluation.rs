use minijinja::value::Serde;
use serde_json::Value;

use super::template_environment::build_template_environment;
use super::template_functions::TemplateFunctions;
use super::template_problems::find_template_problems;
use super::template_renderer::describe_render_error;
use super::{TemplateEscape, TemplateProblem, TemplateProblemSeverity, TemplateRenderMode};

/// Evaluates one expression, such as `data.to[0].address | lower` or `random_int(1, 9)`, and
/// keeps its type: a number stays a number and a list stays a list. A missing value is null.
pub fn evaluate_template_expression(
    expression_text: &str,
    template_context: &Value,
    template_functions: &dyn TemplateFunctions,
    render_mode: TemplateRenderMode,
) -> Result<Value, TemplateProblem> {
    let wrapped_text = format!("{{{{ {expression_text} }}}}");
    let function_names = template_functions.function_names();
    let static_problem =
        find_template_problems(&wrapped_text, template_context, &function_names, false)
            .into_iter()
            .find(|problem| problem.severity == TemplateProblemSeverity::Error);
    if let Some(static_problem) = static_problem {
        return Err(static_problem);
    }
    let environment = build_template_environment(
        template_functions.to_shared(),
        TemplateEscape::None,
        render_mode,
    );
    let evaluated_value = environment
        .compile_expression(expression_text)
        .and_then(|expression| expression.eval(minijinja::Value::from(Serde(template_context))))
        .map_err(|evaluation_error| describe_render_error(expression_text, &evaluation_error))?;
    if evaluated_value.is_undefined() {
        return Ok(Value::Null);
    }
    Ok(serde_json::to_value(&evaluated_value).unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use serde_json::json;

    use super::*;
    use crate::{FixedClock, SeededRandomSource, StandardTemplateFunctions};

    fn evaluate(
        expression_text: &str,
        render_mode: TemplateRenderMode,
    ) -> Result<Value, TemplateProblem> {
        let template_functions = StandardTemplateFunctions::new(
            Arc::new(FixedClock::new(0)),
            Arc::new(SeededRandomSource::new(1)),
        );
        let template_context = json!({ "data": { "to": [{ "address": "Ann@Example.com" }] } });
        evaluate_template_expression(
            expression_text,
            &template_context,
            &template_functions,
            render_mode,
        )
    }

    #[test]
    fn expressions_keep_their_type() {
        assert_eq!(
            evaluate("data.to[0].address | lower", TemplateRenderMode::Strict),
            Ok(json!("ann@example.com"))
        );
        assert_eq!(
            evaluate("random_int(7, 7)", TemplateRenderMode::Strict),
            Ok(json!(7))
        );
        assert_eq!(
            evaluate("data.to | length > 0", TemplateRenderMode::Strict),
            Ok(json!(true))
        );
        assert_eq!(
            evaluate("data.missing", TemplateRenderMode::Lenient),
            Ok(Value::Null)
        );
    }

    #[test]
    fn bad_expressions_are_reported() {
        let unknown_function = evaluate("shout()", TemplateRenderMode::Lenient);
        let syntax_error = evaluate("data.to[", TemplateRenderMode::Lenient);

        assert_eq!(
            unknown_function.map_err(|problem| problem.message),
            Err("Unknown function: shout".to_owned())
        );
        assert!(syntax_error.is_err_and(|problem| problem.message.starts_with("Syntax error")));
    }
}
