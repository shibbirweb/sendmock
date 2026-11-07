use schemars::JsonSchema;
use sendmock_core::{
    TemplateEscape, TemplateFunctions, TemplateProblem, TemplateProblemSeverity,
    TemplateRenderMode, render_template_in_mode,
};
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum RenderProblemSeverity {
    Error,
    Warning,
}

/// A render problem and where it comes from, e.g. "body" at line 3 (WH-07.15).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct RenderProblem {
    pub message: String,
    pub severity: RenderProblemSeverity,
    /// "url", "query.0", "header.0", "field.0", "body" or "vars".
    pub source: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<usize>")]
    pub line: Option<usize>,
    #[schemars(required, schema_with = "crate::nullable_schema::<usize>")]
    pub column: Option<usize>,
}

impl RenderProblem {
    pub fn from_template_problem(template_problem: TemplateProblem, source: &str) -> Self {
        Self {
            message: template_problem.message,
            severity: match template_problem.severity {
                TemplateProblemSeverity::Error => RenderProblemSeverity::Error,
                TemplateProblemSeverity::Warning => RenderProblemSeverity::Warning,
            },
            source: source.to_owned(),
            line: template_problem.line,
            column: template_problem.column,
        }
    }

    /// A problem with a rendered value rather than with the template text.
    pub fn error(message: String, source: &str) -> Self {
        Self {
            message,
            severity: RenderProblemSeverity::Error,
            source: source.to_owned(),
            line: None,
            column: None,
        }
    }
}

/// Renders the parts of one request against one context, collecting each part's problems
/// under its source.
pub struct RequestPartRenderer<'renderer> {
    pub template_context: &'renderer Value,
    pub template_functions: &'renderer dyn TemplateFunctions,
    pub render_mode: TemplateRenderMode,
    pub problems: Vec<RenderProblem>,
}

impl RequestPartRenderer<'_> {
    pub fn render_part(
        &mut self,
        template_text: &str,
        source: &str,
        escape: TemplateEscape,
    ) -> String {
        let rendered = render_template_in_mode(
            template_text,
            self.template_context,
            self.template_functions,
            escape,
            self.render_mode,
        );
        self.problems
            .extend(rendered.problems.into_iter().map(|template_problem| {
                RenderProblem::from_template_problem(template_problem, source)
            }));
        rendered.text
    }

    pub fn has_errors(&self) -> bool {
        self.problems
            .iter()
            .any(|problem| problem.severity == RenderProblemSeverity::Error)
    }
}
