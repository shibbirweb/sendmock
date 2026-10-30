use serde_json::Value;

/// JSON for scripts and agents; `key: value` lines for people.
pub fn format_output(answer: &Value, as_json: bool) -> String {
    if as_json {
        return serde_json::to_string_pretty(answer).unwrap_or_default();
    }
    match answer.as_object() {
        Some(fields) => fields
            .iter()
            .map(|(field_name, field_value)| format!("{field_name}: {}", format_value(field_value)))
            .collect::<Vec<_>>()
            .join("\n"),
        None => format_value(answer),
    }
}

fn format_value(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Null => "-".to_owned(),
        other => other.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn prints_pretty_json_when_asked() {
        assert_eq!(
            format_output(&json!({ "status": "ok" }), true),
            "{\n  \"status\": \"ok\"\n}"
        );
    }

    #[test]
    fn prints_one_field_per_line_for_people() {
        let answer = json!({ "version": "0.1.0", "uptime_seconds": 12, "provider_address": null });

        assert_eq!(
            format_output(&answer, false),
            "provider_address: -\nuptime_seconds: 12\nversion: 0.1.0"
        );
    }
}
