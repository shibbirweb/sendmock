use std::sync::Arc;

use serde_json::Value;

use crate::{Clock, RandomSource, format_rfc3339};

const ALPHANUMERIC_CHARACTERS: &[u8] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const DEFAULT_RANDOM_LENGTH: usize = 32;

/// The functions a template may call, such as `uuid()`; `None` means the name is unknown.
pub trait TemplateFunctions: Send + Sync {
    fn call_function(&self, function_name: &str, arguments: &[Value]) -> Option<Value>;
}

/// `uuid()`, `random_hex(n)`, `random_string(n)`, `now_iso()` and `now_unix()`, over the
/// clock and random source so tests are deterministic.
pub struct StandardTemplateFunctions {
    clock: Arc<dyn Clock>,
    random_source: Arc<dyn RandomSource>,
}

impl StandardTemplateFunctions {
    pub fn new(clock: Arc<dyn Clock>, random_source: Arc<dyn RandomSource>) -> Self {
        Self {
            clock,
            random_source,
        }
    }

    fn random_hex(&self, length: usize) -> String {
        let mut hex_text = String::with_capacity(length + 16);
        while hex_text.len() < length {
            hex_text.push_str(&format!("{:016x}", self.random_source.next_u64()));
        }
        hex_text.truncate(length);
        hex_text
    }

    fn random_string(&self, length: usize) -> String {
        (0..length)
            .map(|_| {
                let character_index =
                    self.random_source.next_u64() as usize % ALPHANUMERIC_CHARACTERS.len();
                char::from(ALPHANUMERIC_CHARACTERS[character_index])
            })
            .collect()
    }

    /// A version 4 UUID from the random source.
    fn uuid(&self) -> String {
        let hex_text = self.random_hex(32);
        format!(
            "{}-{}-4{}-{}{}-{}",
            &hex_text[0..8],
            &hex_text[8..12],
            &hex_text[13..16],
            ["8", "9", "a", "b"][usize::from(hex_text.as_bytes()[16] % 4)],
            &hex_text[17..20],
            &hex_text[20..32]
        )
    }
}

/// A length argument such as `32` or `"32"`, or the default.
fn read_length(arguments: &[Value]) -> usize {
    match arguments.first() {
        Some(Value::Number(length)) => length.as_u64().map_or(DEFAULT_RANDOM_LENGTH, |length| {
            usize::try_from(length).unwrap_or(DEFAULT_RANDOM_LENGTH)
        }),
        Some(Value::String(length_text)) => {
            length_text.trim().parse().unwrap_or(DEFAULT_RANDOM_LENGTH)
        }
        _ => DEFAULT_RANDOM_LENGTH,
    }
    .min(1024)
}

impl TemplateFunctions for StandardTemplateFunctions {
    fn call_function(&self, function_name: &str, arguments: &[Value]) -> Option<Value> {
        let now_unix_ms = self.clock.now_unix_ms();
        let result = match function_name {
            "uuid" => self.uuid(),
            "random_hex" => self.random_hex(read_length(arguments)),
            "random_string" => self.random_string(read_length(arguments)),
            "now_iso" => format_rfc3339(now_unix_ms),
            "now_unix" => (now_unix_ms / 1000).to_string(),
            _ => return None,
        };
        Some(Value::String(result))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{FixedClock, SeededRandomSource};

    fn functions() -> StandardTemplateFunctions {
        StandardTemplateFunctions::new(
            Arc::new(FixedClock::new(1_767_225_600_000)),
            Arc::new(SeededRandomSource::new(7)),
        )
    }

    #[test]
    fn random_values_have_the_asked_length() {
        let template_functions = functions();

        let hex_text = template_functions.call_function("random_hex", &[Value::from(32)]);
        let short_text = template_functions.call_function("random_string", &[Value::from("5")]);

        assert_eq!(
            hex_text.as_ref().and_then(Value::as_str).map(str::len),
            Some(32)
        );
        assert!(
            hex_text
                .as_ref()
                .and_then(Value::as_str)
                .is_some_and(|text| text.chars().all(|character| character.is_ascii_hexdigit()))
        );
        assert_eq!(
            short_text.as_ref().and_then(Value::as_str).map(str::len),
            Some(5)
        );
    }

    #[test]
    fn uuids_are_version_4() {
        let uuid = functions().call_function("uuid", &[]);
        let uuid_text = uuid.as_ref().and_then(Value::as_str).unwrap_or_default();

        assert_eq!(uuid_text.len(), 36);
        assert_eq!(uuid_text.chars().nth(14), Some('4'));
    }

    #[test]
    fn times_come_from_the_clock_and_unknown_names_are_none() {
        let template_functions = functions();

        assert_eq!(
            template_functions.call_function("now_unix", &[]),
            Some(Value::from("1767225600"))
        );
        assert_eq!(
            template_functions.call_function("now_iso", &[]),
            Some(Value::from("2026-01-01T00:00:00Z"))
        );
        assert_eq!(template_functions.call_function("sha256", &[]), None);
    }
}
