//! The `fake` global: `fake.name()` and the other `fake.*` methods, answered by the same
//! function table as `uuid()`, so a fixed random source fixes them too.

use std::sync::Arc;

use minijinja::value::{Object, Serde};
use minijinja::{Error, ErrorKind, State, Value};

use super::template_functions::TemplateFunctions;

pub struct FakeNamespace {
    template_functions: Arc<dyn TemplateFunctions>,
}

impl std::fmt::Debug for FakeNamespace {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("fake")
    }
}

impl FakeNamespace {
    pub fn new_value(template_functions: Arc<dyn TemplateFunctions>) -> Value {
        Value::from_object(Self { template_functions })
    }
}

impl Object for FakeNamespace {
    fn call_method(
        self: &Arc<Self>,
        _state: &mut State<'_, '_>,
        method: &str,
        _arguments: &[Value],
    ) -> Result<Value, Error> {
        self.template_functions
            .call_function(&format!("fake.{method}"), &[])
            .map(|fake_value| Value::from(Serde(fake_value)))
            .ok_or_else(|| Error::new(ErrorKind::UnknownMethod, format!("fake.{method}")))
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use serde_json::json;

    use crate::{
        FixedClock, SeededRandomSource, StandardTemplateFunctions, TemplateEscape, render_template,
    };

    fn build_functions() -> StandardTemplateFunctions {
        StandardTemplateFunctions::new(
            Arc::new(FixedClock::new(1_767_225_600_000)),
            Arc::new(SeededRandomSource::new(9)),
        )
    }

    // AC: WH-07.3
    #[test]
    fn fake_methods_and_lorem_render_through_the_engine() {
        let rendered = render_template(
            "{{ fake.name() }}|{{ fake.email() }}|{{ lorem(3) }}",
            &json!({}),
            &build_functions(),
            TemplateEscape::None,
        );

        let parts: Vec<&str> = rendered.text.split('|').collect();
        assert!(rendered.problems.is_empty(), "{:?}", rendered.problems);
        assert_eq!(parts[0].split(' ').count(), 2);
        assert!(parts[1].contains('@'));
        assert_eq!(parts[2].split(' ').count(), 3);
    }

    // AC: WH-07.3
    #[test]
    fn postman_aliases_render_as_their_functions() {
        let rendered = render_template(
            "{{$randomUUID}} {{$timestamp}} {{$randomFirstName}}",
            &json!({}),
            &build_functions(),
            TemplateEscape::None,
        );

        let parts: Vec<&str> = rendered.text.split(' ').collect();
        assert_eq!(parts[0].len(), 36);
        assert_eq!(parts[1], "1767225600");
        assert!(!parts[2].is_empty());
    }

    #[test]
    fn an_unknown_fake_method_fails_the_render() {
        let rendered = render_template(
            "{{ fake.credit_card() }}",
            &json!({}),
            &build_functions(),
            TemplateEscape::None,
        );

        assert!(rendered.has_errors(), "{}", rendered.text);
    }
}
