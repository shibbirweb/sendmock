//! The `{{ path | filter }}` template language shared by webhook templates, provider
//! definitions and gateways, as the UI's preview renders it.

mod template_expression;
mod template_functions;
mod template_renderer;

pub use template_functions::{StandardTemplateFunctions, TemplateFunctions};
pub use template_renderer::{
    RenderedTemplate, TemplateEscape, TemplateProblem, TemplateProblemSeverity, render_template,
};
