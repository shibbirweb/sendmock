//! Text filters: case, whitespace, length, slicing, replace and match, defaults and
//! formatting ([12](docs/plan/12-webhook-variables.md#text-filters)).

use minijinja::value::{Kwargs, ValueKind};
use minijinja::{Error, ErrorKind, Value};
use regex::Regex;

/// Missing, null or an empty string: what `default` replaces and `required` refuses.
pub fn is_blank(value: &Value) -> bool {
    value.is_undefined() || value.is_none() || value.as_str().is_some_and(str::is_empty)
}

/// The fallback when the value is missing, null or empty.
pub fn default_filter(value: Value, fallback: Option<Value>) -> Value {
    if is_blank(&value) {
        return fallback.unwrap_or_else(|| Value::from(""));
    }
    value
}

/// Stops the render when the value is missing, null or empty.
pub fn required_filter(value: Value, message: Option<String>) -> Result<Value, Error> {
    if is_blank(&value) {
        return Err(Error::new(
            ErrorKind::InvalidOperation,
            message.unwrap_or_else(|| "A required value is empty".to_owned()),
        ));
    }
    Ok(value)
}

pub fn capitalize_filter(text: String) -> String {
    let mut characters = text.chars();
    match characters.next() {
        Some(first_character) => {
            first_character.to_uppercase().collect::<String>() + &characters.as_str().to_lowercase()
        }
        None => String::new(),
    }
}

/// Collapses every run of whitespace into one space and trims the ends.
pub fn squish_filter(text: String) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The first `length` characters, followed by `end` (default `...`) when text was cut.
pub fn truncate_filter(
    text: String,
    length: usize,
    keyword_arguments: Kwargs,
) -> Result<String, Error> {
    let end_text: Option<String> = keyword_arguments.get("end")?;
    keyword_arguments.assert_all_used()?;
    if text.chars().count() <= length {
        return Ok(text);
    }
    let kept_text: String = text.chars().take(length).collect();
    Ok(kept_text + end_text.as_deref().unwrap_or("..."))
}

fn resolve_index(index: i64, item_count: usize) -> usize {
    let item_count_i64 = i64::try_from(item_count).unwrap_or(i64::MAX);
    let resolved_index = if index < 0 {
        item_count_i64 + index
    } else {
        index
    };
    usize::try_from(resolved_index.clamp(0, item_count_i64)).unwrap_or(0)
}

/// Characters or list items from `start` up to `end` (excluded); negative indexes count
/// from the end, as in Python.
pub fn slice_filter(value: Value, start: i64, end: Option<i64>) -> Result<Value, Error> {
    if let Some(text) = value.as_str() {
        let characters: Vec<char> = text.chars().collect();
        let start_index = resolve_index(start, characters.len());
        let end_index = resolve_index(end.unwrap_or(i64::MAX), characters.len());
        let sliced_text: String = characters[start_index..end_index.max(start_index)]
            .iter()
            .collect();
        return Ok(Value::from(sliced_text));
    }
    let items: Vec<Value> = value.try_iter()?.collect();
    let start_index = resolve_index(start, items.len());
    let end_index = resolve_index(end.unwrap_or(i64::MAX), items.len());
    Ok(Value::from(
        items[start_index..end_index.max(start_index)].to_vec(),
    ))
}

fn compile_pattern(pattern: &str) -> Result<Regex, Error> {
    Regex::new(pattern).map_err(|pattern_error| {
        Error::new(
            ErrorKind::InvalidOperation,
            format!("Invalid regex: {pattern_error}"),
        )
    })
}

pub fn regex_replace_filter(
    text: String,
    pattern: String,
    replacement: String,
) -> Result<String, Error> {
    Ok(compile_pattern(&pattern)?
        .replace_all(&text, replacement.as_str())
        .into_owned())
}

/// The match of `pattern`, or its capture `group`; an empty string when nothing matches.
pub fn regex_extract_filter(
    text: String,
    pattern: String,
    group: Option<usize>,
) -> Result<String, Error> {
    let found_text = compile_pattern(&pattern)?
        .captures(&text)
        .and_then(|captures| captures.get(group.unwrap_or(0)))
        .map(|found_match| found_match.as_str().to_owned());
    Ok(found_text.unwrap_or_default())
}

/// Whether text contains a piece of text, or a list contains an item.
pub fn contains_filter(value: Value, needle: Value) -> Result<bool, Error> {
    if let (Some(text), Some(needle_text)) = (value.as_str(), needle.as_str()) {
        return Ok(text.contains(needle_text));
    }
    if value.is_undefined() || value.is_none() {
        return Ok(false);
    }
    Ok(value.try_iter()?.any(|item| item == needle))
}

/// Lowercase ASCII words joined by `-`: `Hello, World!` becomes `hello-world`.
pub fn slugify_filter(text: String) -> String {
    text.to_lowercase()
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|word| !word.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn padding(text: &str, width: usize, pad_character: Option<String>) -> String {
    let pad_text = pad_character
        .and_then(|pad_text| pad_text.chars().next())
        .unwrap_or(' ');
    std::iter::repeat_n(pad_text, width.saturating_sub(text.chars().count())).collect()
}

pub fn pad_left_filter(text: String, width: usize, pad_character: Option<String>) -> String {
    padding(&text, width, pad_character) + &text
}

pub fn pad_right_filter(text: String, width: usize, pad_character: Option<String>) -> String {
    let padding_text = padding(&text, width, pad_character);
    text + &padding_text
}

/// A number with `decimals` places and `,` between thousands: `1234.5` becomes `1,234.50`.
pub fn number_format_filter(value: Value, decimals: Option<usize>) -> Result<String, Error> {
    let number = match value.kind() {
        ValueKind::Number => f64::try_from(value.clone()).unwrap_or(0.0),
        _ => value
            .as_str()
            .and_then(|text| text.trim().parse().ok())
            .ok_or_else(|| {
                Error::new(ErrorKind::InvalidOperation, "number_format needs a number")
            })?,
    };
    let formatted_number = format!("{:.*}", decimals.unwrap_or(0).min(10), number.abs());
    let (whole_digits, fraction_digits) = formatted_number
        .split_once('.')
        .map_or((formatted_number.as_str(), None), |(whole, fraction)| {
            (whole, Some(fraction))
        });
    let mut grouped_digits = String::new();
    for (position, digit) in whole_digits.chars().enumerate() {
        if position > 0 && (whole_digits.len() - position) % 3 == 0 {
            grouped_digits.push(',');
        }
        grouped_digits.push(digit);
    }
    let sign = if number < 0.0 { "-" } else { "" };
    Ok(match fraction_digits {
        Some(fraction) => format!("{sign}{grouped_digits}.{fraction}"),
        None => format!("{sign}{grouped_digits}"),
    })
}
