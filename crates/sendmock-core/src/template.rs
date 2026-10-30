//! The template language shared by webhook templates, provider definitions and gateways:
//! Jinja syntax on `minijinja`, with SendMock's filters and functions
//! ([12](docs/plan/12-webhook-variables.md)).

mod template_date_filters;
mod template_encoding_filters;
mod template_environment;
mod template_event_name_filters;
mod template_expression_evaluation;
mod template_functions;
mod template_hash_filters;
mod template_names;
mod template_phone;
mod template_problems;
mod template_random_values;
mod template_renderer;
mod template_text_filters;

pub use template_environment::TEMPLATE_FUEL_LIMIT;
pub use template_expression_evaluation::evaluate_template_expression;
pub use template_functions::{StandardTemplateFunctions, TemplateFunctions};
pub use template_names::{BUILTIN_FILTER_NAMES, SENDMOCK_FILTER_NAMES};
pub use template_renderer::{
    MAXIMUM_RENDERED_BYTES, RenderedTemplate, TemplateEscape, TemplateProblem,
    TemplateProblemSeverity, TemplateRenderMode, render_template, render_template_in_mode,
};
