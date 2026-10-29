use serde_json::Value;

use super::template_functions::TemplateFunctions;

/// What an expression gave: nothing, a value to escape, or text already in its final form
/// (the `json` filter's output, which must not be escaped again).
#[derive(Debug, Clone, PartialEq)]
pub enum EvaluatedValue {
    Missing,
    Value(Value),
    Verbatim(String),
}

/// What went wrong in one expression; the renderer turns these into problems.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExpressionProblem {
    UnknownFunction(String),
    UnknownFilter(String),
    UndefinedVariable(String),
}

pub struct ExpressionEvaluator<'evaluation> {
    pub template_context: &'evaluation Value,
    pub template_functions: &'evaluation dyn TemplateFunctions,
    pub problems: Vec<ExpressionProblem>,
}

impl ExpressionEvaluator<'_> {
    /// `operand | filter | default("x")`.
    pub fn evaluate(&mut self, expression_text: &str) -> EvaluatedValue {
        let mut expression_parts = split_top_level(expression_text, '|').into_iter();
        let operand_text = expression_parts.next().unwrap_or_default();
        let mut current_value = self.evaluate_operand(&operand_text);
        let mut is_defaulted = false;
        for filter_text in expression_parts {
            if let Some(default_text) = strip_call(&filter_text, "default") {
                is_defaulted = true;
                if is_blank(&current_value) {
                    current_value = self.evaluate_operand(default_text);
                }
                continue;
            }
            match apply_filter(&filter_text, &current_value) {
                Some(filtered_value) => current_value = filtered_value,
                None => self
                    .problems
                    .push(ExpressionProblem::UnknownFilter(filter_text.clone())),
            }
        }
        if current_value == EvaluatedValue::Missing && !is_defaulted {
            self.problems
                .push(ExpressionProblem::UndefinedVariable(operand_text));
        }
        current_value
    }

    /// A string or number literal, a function call or a path into the context.
    fn evaluate_operand(&mut self, operand_text: &str) -> EvaluatedValue {
        let operand_text = operand_text.trim();
        if let Some(literal_text) = operand_text
            .strip_prefix('"')
            .and_then(|rest| rest.strip_suffix('"'))
        {
            return EvaluatedValue::Value(Value::from(literal_text));
        }
        if let Ok(number) = operand_text.parse::<i64>() {
            return EvaluatedValue::Value(Value::from(number));
        }
        if let Some((function_name, arguments_text)) = split_call(operand_text) {
            let arguments: Vec<Value> = split_top_level(arguments_text, ',')
                .iter()
                .filter(|argument_text| !argument_text.is_empty())
                .map(|argument_text| match self.evaluate_operand(argument_text) {
                    EvaluatedValue::Value(argument) => argument,
                    EvaluatedValue::Verbatim(argument) => Value::from(argument),
                    EvaluatedValue::Missing => Value::Null,
                })
                .collect();
            return match self
                .template_functions
                .call_function(function_name, &arguments)
            {
                Some(result) => EvaluatedValue::Value(result),
                None => {
                    self.problems
                        .push(ExpressionProblem::UnknownFunction(function_name.to_owned()));
                    EvaluatedValue::Verbatim(String::new())
                }
            };
        }
        read_path(self.template_context, operand_text)
    }
}

fn is_blank(value: &EvaluatedValue) -> bool {
    match value {
        EvaluatedValue::Missing => true,
        EvaluatedValue::Value(Value::String(text)) => text.is_empty(),
        EvaluatedValue::Verbatim(text) => text.is_empty(),
        EvaluatedValue::Value(_) => false,
    }
}

/// `name(arguments)` split into the name and the argument text.
fn split_call(operand_text: &str) -> Option<(&str, &str)> {
    let (function_name, rest) = operand_text.split_once('(')?;
    let arguments_text = rest.strip_suffix(')')?;
    let is_name = !function_name.is_empty()
        && function_name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_');
    is_name.then_some((function_name, arguments_text))
}

fn strip_call<'text>(filter_text: &'text str, function_name: &str) -> Option<&'text str> {
    split_call(filter_text)
        .filter(|(name, _)| *name == function_name)
        .map(|(_, arguments_text)| arguments_text)
}

/// `data.to[0].address` read from the context; null counts as missing.
fn read_path(template_context: &Value, path_text: &str) -> EvaluatedValue {
    let mut current_value = template_context;
    for path_part in path_text.replace('[', ".").replace(']', "").split('.') {
        let next_value = match current_value {
            Value::Object(fields) => fields.get(path_part),
            Value::Array(items) => path_part
                .parse::<usize>()
                .ok()
                .and_then(|index| items.get(index)),
            _ => None,
        };
        match next_value {
            Some(next_value) => current_value = next_value,
            None => return EvaluatedValue::Missing,
        }
    }
    if current_value.is_null() {
        EvaluatedValue::Missing
    } else {
        EvaluatedValue::Value(current_value.clone())
    }
}

/// The text a value renders as: strings as they are, other values as JSON.
pub fn to_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other_value => other_value.to_string(),
    }
}

/// `None` for an unknown filter, which leaves the value as it was. Filters leave a missing
/// value missing.
fn apply_filter(filter_name: &str, current_value: &EvaluatedValue) -> Option<EvaluatedValue> {
    let input_text = match current_value {
        EvaluatedValue::Missing => {
            return is_known_filter(filter_name).then_some(EvaluatedValue::Missing);
        }
        EvaluatedValue::Value(value) => to_text(value),
        EvaluatedValue::Verbatim(text) => text.clone(),
    };
    let filtered_text = match filter_name {
        "json" => {
            let json_value = match current_value {
                EvaluatedValue::Value(value) => value.clone(),
                _ => Value::from(input_text),
            };
            return Some(EvaluatedValue::Verbatim(
                serde_json::to_string_pretty(&json_value).unwrap_or_default(),
            ));
        }
        "urlencode" => encode_uri_component(&input_text),
        "lower" => input_text.to_lowercase(),
        "upper" => input_text.to_uppercase(),
        _ => return None,
    };
    Some(EvaluatedValue::Value(Value::from(filtered_text)))
}

fn is_known_filter(filter_name: &str) -> bool {
    matches!(filter_name, "json" | "urlencode" | "lower" | "upper")
}

/// Percent-encodes everything but `A-Z a-z 0-9 - _ . ! ~ * ' ( )`, as JavaScript's
/// `encodeURIComponent` does.
fn encode_uri_component(text: &str) -> String {
    let mut encoded_text = String::with_capacity(text.len());
    for byte in text.bytes() {
        if byte.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&byte) {
            encoded_text.push(char::from(byte));
        } else {
            encoded_text.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded_text
}

/// Splits on `separator` outside quotes and parentheses, trimming each part.
fn split_top_level(text: &str, separator: char) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current_part = String::new();
    let (mut depth, mut is_in_string) = (0_i32, false);
    for character in text.chars() {
        match character {
            '"' => is_in_string = !is_in_string,
            '(' if !is_in_string => depth += 1,
            ')' if !is_in_string => depth -= 1,
            _ => {}
        }
        if character == separator && !is_in_string && depth == 0 {
            parts.push(current_part.trim().to_owned());
            current_part.clear();
            continue;
        }
        current_part.push(character);
    }
    parts.push(current_part.trim().to_owned());
    parts
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uri_components_are_encoded_like_javascript() {
        assert_eq!(encode_uri_component("+1 555/ok?"), "%2B1%20555%2Fok%3F");
        assert_eq!(encode_uri_component("señor"), "se%C3%B1or");
        assert_eq!(encode_uri_component("a-b_c.d!~*'()"), "a-b_c.d!~*'()");
    }

    #[test]
    fn top_level_splitting_respects_quotes_and_calls() {
        assert_eq!(
            split_top_level(r#"a | default("x|y") | f(b, c)"#, '|'),
            vec!["a", r#"default("x|y")"#, "f(b, c)"]
        );
    }
}
