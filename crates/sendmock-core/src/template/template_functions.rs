use std::sync::Arc;

use serde_json::{Map, Value};

use super::template_phone::generate_random_phone;
use super::template_random_values::{
    generate_random_float, generate_random_hex, generate_random_int, generate_random_text,
    generate_ulid, generate_uuid_v4, generate_uuid_v7, random_index, read_charset,
};
use crate::{Clock, RandomSource, format_rfc3339};

const DEFAULT_RANDOM_LENGTH: usize = 32;
const MAXIMUM_RANDOM_LENGTH: usize = 1024;

/// The functions a template may call, such as `uuid()`. Keyword arguments arrive as one
/// object after the positional ones.
pub trait TemplateFunctions: Send + Sync {
    /// `None` means the name is unknown.
    fn call_function(&self, function_name: &str, arguments: &[Value]) -> Option<Value>;
    /// Every name `call_function` answers, so the engine can offer them to templates.
    fn function_names(&self) -> Vec<&'static str>;
    /// A shared copy the engine keeps while it renders.
    fn to_shared(&self) -> Arc<dyn TemplateFunctions>;
}

const STANDARD_FUNCTION_NAMES: &[&str] = &[
    "uuid",
    "uuid7",
    "ulid",
    "now",
    "now_iso",
    "now_unix",
    "timestamp",
    "timestamp_ms",
    "random_int",
    "random_float",
    "random_bool",
    "random_string",
    "random_hex",
    "random_otp",
    "random_choice",
    "random_phone",
];

/// The time and random functions of [12](docs/plan/12-webhook-variables.md), over the clock
/// and random source so tests are deterministic.
#[derive(Clone)]
pub struct StandardTemplateFunctions {
    clock: Arc<dyn Clock>,
    random_source: Arc<dyn RandomSource>,
}

/// Positional arguments, then keyword arguments by name.
struct FunctionArguments<'call> {
    positional: &'call [Value],
    keyword: Option<&'call Map<String, Value>>,
}

impl<'call> FunctionArguments<'call> {
    fn new(arguments: &'call [Value]) -> Self {
        match arguments.split_last() {
            Some((Value::Object(keyword), positional)) => Self {
                positional,
                keyword: Some(keyword),
            },
            _ => Self {
                positional: arguments,
                keyword: None,
            },
        }
    }

    fn read(&self, position: usize, argument_name: &str) -> Option<&'call Value> {
        self.positional
            .get(position)
            .or_else(|| self.keyword.and_then(|keyword| keyword.get(argument_name)))
    }

    fn read_float(&self, position: usize, argument_name: &str) -> Option<f64> {
        match self.read(position, argument_name)? {
            Value::Number(number) => number.as_f64(),
            Value::String(number_text) => number_text.trim().parse().ok(),
            _ => None,
        }
    }

    fn read_integer(&self, position: usize, argument_name: &str) -> Option<i64> {
        self.read_float(position, argument_name)
            .map(|number| number as i64)
    }

    fn read_length(&self, position: usize, argument_name: &str, default_length: usize) -> usize {
        self.read_integer(position, argument_name)
            .and_then(|length| usize::try_from(length).ok())
            .unwrap_or(default_length)
            .min(MAXIMUM_RANDOM_LENGTH)
    }

    fn read_text(&self, position: usize, argument_name: &str) -> Option<&'call str> {
        self.read(position, argument_name).and_then(Value::as_str)
    }
}

impl StandardTemplateFunctions {
    pub fn new(clock: Arc<dyn Clock>, random_source: Arc<dyn RandomSource>) -> Self {
        Self {
            clock,
            random_source,
        }
    }

    fn call_random_function(
        &self,
        function_name: &str,
        arguments: &FunctionArguments,
    ) -> Option<Value> {
        let random_source = self.random_source.as_ref();
        let random_value = match function_name {
            "random_int" => Value::from(generate_random_int(
                random_source,
                arguments.read_integer(0, "min").unwrap_or(0),
                arguments.read_integer(1, "max").unwrap_or(100),
            )),
            "random_float" => Value::from(generate_random_float(
                random_source,
                arguments.read_float(0, "min").unwrap_or(0.0),
                arguments.read_float(1, "max").unwrap_or(1.0),
                u32::try_from(arguments.read_integer(2, "decimals").unwrap_or(2)).unwrap_or(2),
            )),
            "random_bool" => Value::from(random_source.next_u64() % 2 == 1),
            "random_string" => Value::from(generate_random_text(
                random_source,
                arguments.read_length(0, "len", DEFAULT_RANDOM_LENGTH),
                read_charset(arguments.read_text(1, "charset").unwrap_or("alnum")),
            )),
            "random_hex" => Value::from(generate_random_hex(
                random_source,
                arguments.read_length(0, "len", DEFAULT_RANDOM_LENGTH),
            )),
            "random_otp" => Value::from(generate_random_text(
                random_source,
                arguments.read_length(0, "digits", 6),
                read_charset("numeric"),
            )),
            "random_choice" => pick_random_item(random_source, arguments.read(0, "list")),
            "random_phone" => Value::from(generate_random_phone(
                random_source,
                arguments.read_text(0, "country").unwrap_or("US"),
            )),
            _ => return None,
        };
        Some(random_value)
    }
}

fn pick_random_item(random_source: &dyn RandomSource, list: Option<&Value>) -> Value {
    match list {
        Some(Value::Array(items)) if !items.is_empty() => {
            items[random_index(random_source, items.len())].clone()
        }
        _ => Value::Null,
    }
}

impl TemplateFunctions for StandardTemplateFunctions {
    fn call_function(&self, function_name: &str, arguments: &[Value]) -> Option<Value> {
        let now_unix_ms = self.clock.now_unix_ms();
        let random_source = self.random_source.as_ref();
        let generated_value = match function_name {
            "uuid" => Value::from(generate_uuid_v4(random_source)),
            "uuid7" => Value::from(generate_uuid_v7(random_source, now_unix_ms)),
            "ulid" => Value::from(generate_ulid(random_source, now_unix_ms)),
            "now" | "now_iso" => Value::from(format_rfc3339(now_unix_ms)),
            "now_unix" => Value::from((now_unix_ms / 1000).to_string()),
            "timestamp" => Value::from(now_unix_ms / 1000),
            "timestamp_ms" => Value::from(now_unix_ms),
            _ => {
                return self
                    .call_random_function(function_name, &FunctionArguments::new(arguments));
            }
        };
        Some(generated_value)
    }

    fn function_names(&self) -> Vec<&'static str> {
        STANDARD_FUNCTION_NAMES.to_vec()
    }

    fn to_shared(&self) -> Arc<dyn TemplateFunctions> {
        Arc::new(self.clone())
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::{FixedClock, SeededRandomSource};

    fn functions() -> StandardTemplateFunctions {
        StandardTemplateFunctions::new(
            Arc::new(FixedClock::new(1_767_225_600_000)),
            Arc::new(SeededRandomSource::new(7)),
        )
    }

    fn call_text(function_name: &str, arguments: &[Value]) -> String {
        functions()
            .call_function(function_name, arguments)
            .and_then(|value| value.as_str().map(str::to_owned))
            .unwrap_or_default()
    }

    // AC: WH-07.3
    #[test]
    fn random_text_has_the_asked_length_and_charset() {
        let hex_text = call_text("random_hex", &[json!(32)]);
        let upper_text = call_text("random_string", &[json!(5), json!({ "charset": "upper" })]);
        let otp_code = call_text("random_otp", &[json!({ "digits": 4 })]);

        assert_eq!(hex_text.len(), 32);
        assert!(
            hex_text
                .chars()
                .all(|character| character.is_ascii_hexdigit())
        );
        assert_eq!(upper_text.len(), 5);
        assert!(
            upper_text
                .chars()
                .all(|character| character.is_ascii_uppercase())
        );
        assert_eq!(otp_code.len(), 4);
        assert!(otp_code.chars().all(|character| character.is_ascii_digit()));
    }

    // AC: WH-07.3
    #[test]
    fn times_come_from_the_clock() {
        let template_functions = functions();

        assert_eq!(
            template_functions.call_function("now_unix", &[]),
            Some(json!("1767225600"))
        );
        assert_eq!(
            template_functions.call_function("timestamp", &[]),
            Some(json!(1_767_225_600))
        );
        assert_eq!(
            template_functions.call_function("timestamp_ms", &[]),
            Some(json!(1_767_225_600_000_i64))
        );
        assert_eq!(
            template_functions.call_function("now", &[]),
            Some(json!("2026-01-01T00:00:00Z"))
        );
    }

    // AC: WH-07.3
    #[test]
    fn choices_booleans_and_phones_are_well_formed() {
        let template_functions = functions();

        let picked_item = template_functions.call_function("random_choice", &[json!(["a", "b"])]);
        let random_bool = template_functions.call_function("random_bool", &[]);
        let empty_choice = template_functions.call_function("random_choice", &[json!([])]);
        let phone_number = call_text("random_phone", &[json!("GB")]);

        assert!(matches!(picked_item, Some(Value::String(item)) if item == "a" || item == "b"));
        assert!(matches!(random_bool, Some(Value::Bool(_))));
        assert_eq!(empty_choice, Some(Value::Null));
        assert!(phone_number.starts_with("+44"));
        assert_eq!(template_functions.call_function("sha256", &[]), None);
    }
}
