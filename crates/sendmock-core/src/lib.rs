//! Shared types every SendMock crate builds on: events, value objects, errors and the clock and id traits.

pub mod byte_size;
pub mod clock;
pub mod id_generator;
pub mod random_source;
pub mod template;
pub mod timestamp;

pub use byte_size::parse_size_bytes;
pub use clock::{Clock, FixedClock, SystemClock};
pub use id_generator::{IdGenerator, SequentialIdGenerator, SystemIdGenerator};
pub use random_source::{RandomSource, SeededRandomSource, SystemRandomSource};
pub use template::{
    RenderedTemplate, StandardTemplateFunctions, TemplateEscape, TemplateFunctions,
    TemplateProblem, TemplateProblemSeverity, TemplateRenderMode, render_template,
    render_template_in_mode,
};
pub use timestamp::{format_rfc3339, format_rfc5322, parse_duration_ms, parse_rfc3339};
