use minijinja::value::Serde;
use minijinja::{Error, ErrorKind};
use serde_json::Value;

use super::template_environment::build_template_environment;
use super::template_functions::TemplateFunctions;
use super::template_problems::{build_problem, find_template_problems};

/// The largest text one render may produce (1 MB), so a bad template cannot fill memory.
pub const MAXIMUM_RENDERED_BYTES: usize = 1024 * 1024;

/// How rendered values are written: as they are, or escaped for a place inside a JSON string,
/// so a message body with quotes keeps a JSON answer valid.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TemplateEscape {
    None,
    JsonString,
}

/// Lenient renders an undefined value as nothing with a warning; strict stops with an error.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TemplateRenderMode {
    Lenient,
    Strict,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TemplateProblemSeverity {
    /// An undefined value in lenient mode; it renders empty.
    Warning,
    /// An unknown function or filter, a syntax error, or a failed render; saving is refused.
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateProblem {
    pub severity: TemplateProblemSeverity,
    pub message: String,
    /// Where in the template the problem starts (from 1), when known.
    pub line: Option<usize>,
    pub column: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderedTemplate {
    pub text: String,
    pub problems: Vec<TemplateProblem>,
}

impl RenderedTemplate {
    pub fn has_errors(&self) -> bool {
        self.problems
            .iter()
            .any(|problem| problem.severity == TemplateProblemSeverity::Error)
    }
}

/// Renders leniently, as the UI preview does: an undefined value renders empty with a warning.
pub fn render_template(
    template_text: &str,
    template_context: &Value,
    template_functions: &dyn TemplateFunctions,
    escape: TemplateEscape,
) -> RenderedTemplate {
    render_template_in_mode(
        template_text,
        template_context,
        template_functions,
        escape,
        TemplateRenderMode::Lenient,
    )
}

/// Renders in a mode. Unknown names and unbalanced braces are found before rendering and
/// stop it (the text is returned as written); a failed render returns no text.
pub fn render_template_in_mode(
    template_text: &str,
    template_context: &Value,
    template_functions: &dyn TemplateFunctions,
    escape: TemplateEscape,
    render_mode: TemplateRenderMode,
) -> RenderedTemplate {
    let function_names = template_functions.function_names();
    let mut problems = find_template_problems(
        template_text,
        template_context,
        &function_names,
        render_mode == TemplateRenderMode::Lenient,
    );
    let static_result = RenderedTemplate {
        text: template_text.to_owned(),
        problems: problems.clone(),
    };
    if static_result.has_errors() {
        return static_result;
    }
    let environment =
        build_template_environment(template_functions.to_shared(), escape, render_mode);
    let render_result = environment.render_str(
        template_text,
        minijinja::Value::from(Serde(template_context)),
    );
    let rendered_text = match render_result {
        Ok(rendered_text) if rendered_text.len() > MAXIMUM_RENDERED_BYTES => {
            let message = "The rendered text is over 1 MB".to_owned();
            problems.push(build_problem(
                template_text,
                TemplateProblemSeverity::Error,
                message,
                0,
            ));
            String::new()
        }
        Ok(rendered_text) => rendered_text,
        Err(render_error) => {
            problems.push(describe_render_error(template_text, &render_error));
            String::new()
        }
    };
    RenderedTemplate {
        text: rendered_text,
        problems,
    }
}

/// The expression an error points at, without its `{{ }}`.
fn read_error_source(template_text: &str, render_error: &Error) -> Option<String> {
    let error_range = render_error.range()?;
    let source_text = template_text.get(error_range)?;
    let expression_text = source_text
        .trim()
        .trim_start_matches("{{")
        .trim_end_matches("}}")
        .trim();
    (!expression_text.is_empty()).then(|| expression_text.to_owned())
}

fn describe_render_error(template_text: &str, render_error: &Error) -> TemplateProblem {
    let detail = render_error.detail().unwrap_or_default();
    let message = match render_error.kind() {
        ErrorKind::UndefinedError => match read_error_source(template_text, render_error) {
            Some(expression_text) => format!("Undefined variable: {expression_text}"),
            None => "Undefined variable".to_owned(),
        },
        ErrorKind::SyntaxError => format!("Syntax error: {detail}"),
        ErrorKind::OutOfFuel => "The template ran too long and was stopped".to_owned(),
        ErrorKind::UnknownFilter => format!("Unknown filter: {detail}"),
        ErrorKind::UnknownFunction => format!("Unknown function: {detail}"),
        other_kind if detail.is_empty() => other_kind.to_string(),
        _ => detail.to_owned(),
    };
    let byte_offset = render_error
        .range()
        .map(|error_range| error_range.start)
        .or_else(|| {
            let error_line = render_error.line()?;
            Some(line_start_offset(template_text, error_line))
        })
        .unwrap_or(0);
    build_problem(
        template_text,
        TemplateProblemSeverity::Error,
        message,
        byte_offset,
    )
}

fn line_start_offset(template_text: &str, line: usize) -> usize {
    template_text
        .match_indices('\n')
        .nth(line.saturating_sub(2))
        .filter(|_| line > 1)
        .map_or(0, |(newline_index, _)| newline_index + 1)
}
