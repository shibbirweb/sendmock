//! Problems found by reading a template before it renders, as the UI preview finds them:
//! unbalanced `{{`, unknown functions and filters, and (in lenient mode) values the context
//! does not have. Each problem carries its line and column.

use std::collections::HashSet;
use std::sync::LazyLock;

use regex::Regex;
use serde_json::Value;

use super::template_names::{BUILTIN_FILTER_NAMES, BUILTIN_FUNCTION_NAMES, SENDMOCK_FILTER_NAMES};
use super::{TemplateProblem, TemplateProblemSeverity};

const KEYWORDS_BEFORE_PARENTHESES: &[&str] = &["if", "elif", "in", "and", "or", "not", "for", "is"];

static EXPRESSION_PATTERN: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"\{\{([\s\S]*?)\}\}").ok());
static BLOCK_PATTERN: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}").ok());
static STRING_LITERAL_PATTERN: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r#""(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'"#).ok());
static NAME_PATTERN: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"(\|\s*)?([A-Za-z_][A-Za-z0-9_]*)(\s*\()?").ok());
static BOUND_NAME_PATTERN: LazyLock<Option<Regex>> = LazyLock::new(|| {
    Regex::new(r"\{%-?\s*(?:for\s+([A-Za-z_][\w\s,]*?)\s+in\b|set\s+([A-Za-z_]\w*))").ok()
});
static PATH_PATTERN: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"^[A-Za-z_]\w*(?:\.\w+|\[\d+\])*$").ok());

/// Line and column (both from 1) of a byte offset.
pub fn locate_offset(template_text: &str, byte_offset: usize) -> (usize, usize) {
    let text_before = &template_text[..byte_offset.min(template_text.len())];
    let line = text_before.matches('\n').count() + 1;
    let line_start = text_before
        .rfind('\n')
        .map_or(0, |newline_index| newline_index + 1);
    (line, text_before[line_start..].chars().count() + 1)
}

pub fn build_problem(
    template_text: &str,
    severity: TemplateProblemSeverity,
    message: String,
    byte_offset: usize,
) -> TemplateProblem {
    let (line, column) = locate_offset(template_text, byte_offset);
    TemplateProblem {
        severity,
        message,
        line: Some(line),
        column: Some(column),
    }
}

/// Where a `{{` without a matching `}}` starts. A lone `}}` is text, so JSON ending in `}}`
/// is fine.
fn find_unbalanced_brace(template_text: &str) -> Option<usize> {
    let expression_pattern = EXPRESSION_PATTERN.as_ref()?;
    let covered_ranges: Vec<std::ops::Range<usize>> = expression_pattern
        .find_iter(template_text)
        .map(|expression_match| expression_match.range())
        .collect();
    template_text
        .match_indices("{{")
        .map(|(brace_index, _)| brace_index)
        .find(|brace_index| {
            !covered_ranges
                .iter()
                .any(|covered_range| covered_range.contains(brace_index))
        })
}

/// Unknown filters (`| name`) and functions (`name(`) in every `{{ }}` and `{% %}` block.
fn find_unknown_names(template_text: &str, function_names: &[&str]) -> Vec<(String, usize)> {
    let (Some(block_pattern), Some(string_pattern), Some(name_pattern)) = (
        BLOCK_PATTERN.as_ref(),
        STRING_LITERAL_PATTERN.as_ref(),
        NAME_PATTERN.as_ref(),
    ) else {
        return Vec::new();
    };
    let mut unknown_names = Vec::new();
    for block_match in block_pattern.find_iter(template_text) {
        let block_text = string_pattern
            .replace_all(block_match.as_str(), |found: &regex::Captures| {
                " ".repeat(found[0].len())
            });
        for name_captures in name_pattern.captures_iter(&block_text) {
            let name_match = &name_captures[2];
            let preceding_text =
                block_text[..name_captures.get(0).map_or(0, |found| found.start())].trim_end();
            let is_filter = name_captures.get(1).is_some();
            let is_call = name_captures.get(3).is_some();
            let is_known = if is_filter {
                BUILTIN_FILTER_NAMES.contains(&name_match)
                    || SENDMOCK_FILTER_NAMES.contains(&name_match)
            } else {
                !is_call
                    || preceding_text.ends_with('.')
                    || preceding_text.ends_with(" is")
                    || preceding_text.ends_with(" not")
                    || KEYWORDS_BEFORE_PARENTHESES.contains(&name_match)
                    || function_names.contains(&name_match)
                    || BUILTIN_FUNCTION_NAMES.contains(&name_match)
            };
            if !is_known {
                let kind = if is_filter { "filter" } else { "function" };
                unknown_names.push((format!("Unknown {kind}: {name_match}"), block_match.start()));
            }
        }
    }
    unknown_names
}

/// Names a template binds itself (`for x in`, `set x`), which the context does not have.
fn find_bound_names(template_text: &str) -> HashSet<String> {
    let mut bound_names: HashSet<String> = ["loop".to_owned()].into_iter().collect();
    if let Some(bound_name_pattern) = BOUND_NAME_PATTERN.as_ref() {
        for bound_captures in bound_name_pattern.captures_iter(template_text) {
            let names_text = bound_captures
                .get(1)
                .or_else(|| bound_captures.get(2))
                .map_or("", |found| found.as_str());
            bound_names.extend(names_text.split(',').map(|name| name.trim().to_owned()));
        }
    }
    bound_names
}

/// `data.to[0].address` read from the context; `None` when missing or null.
fn read_context_path<'context>(
    template_context: &'context Value,
    path_text: &str,
) -> Option<&'context Value> {
    let mut current_value = template_context;
    for path_part in path_text.replace('[', ".").replace(']', "").split('.') {
        current_value = match current_value {
            Value::Object(fields) => fields.get(path_part)?,
            Value::Array(items) => items.get(path_part.parse::<usize>().ok()?)?,
            _ => return None,
        };
    }
    (!current_value.is_null()).then_some(current_value)
}

/// `{{ path }}` expressions whose path the context does not have, unless `default` or
/// `required` follows.
fn find_undefined_paths(
    template_text: &str,
    template_context: &Value,
    function_names: &[&str],
) -> Vec<(String, usize)> {
    let (Some(expression_pattern), Some(path_pattern)) =
        (EXPRESSION_PATTERN.as_ref(), PATH_PATTERN.as_ref())
    else {
        return Vec::new();
    };
    let bound_names = find_bound_names(template_text);
    let mut undefined_paths = Vec::new();
    for expression_captures in expression_pattern.captures_iter(template_text) {
        let expression_text = expression_captures[1]
            .trim()
            .trim_start_matches('-')
            .trim_end_matches('-')
            .trim();
        let mut expression_parts = expression_text.split('|').map(str::trim);
        let operand_text = expression_parts.next().unwrap_or_default();
        // `default` and `required` handle a missing value themselves.
        let has_default = expression_parts.any(|filter_text| {
            filter_text.starts_with("default")
                || filter_text.starts_with("required")
                || filter_text == "d"
                || filter_text.starts_with("d(")
        });
        let root_name = operand_text.split(['.', '[']).next().unwrap_or_default();
        let is_checked_path = path_pattern.is_match(operand_text)
            && !has_default
            && !bound_names.contains(root_name)
            && !function_names.contains(&root_name)
            && !matches!(
                operand_text,
                "true" | "false" | "none" | "True" | "False" | "None"
            );
        if is_checked_path && read_context_path(template_context, operand_text).is_none() {
            let expression_offset = expression_captures.get(0).map_or(0, |found| found.start());
            undefined_paths.push((
                format!("Undefined variable: {operand_text}"),
                expression_offset,
            ));
        }
    }
    undefined_paths
}

/// Errors that stop the render, then (when asked) warnings for undefined values.
pub fn find_template_problems(
    template_text: &str,
    template_context: &Value,
    function_names: &[&str],
    should_warn_undefined: bool,
) -> Vec<TemplateProblem> {
    let mut problems: Vec<TemplateProblem> = Vec::new();
    let mut add_problem = |severity, message: String, byte_offset| {
        if !problems.iter().any(|problem| problem.message == message) {
            problems.push(build_problem(template_text, severity, message, byte_offset));
        }
    };
    for (message, byte_offset) in find_unknown_names(template_text, function_names) {
        add_problem(TemplateProblemSeverity::Error, message, byte_offset);
    }
    if let Some(brace_offset) = find_unbalanced_brace(template_text) {
        let message = "Unbalanced {{ }}: every {{ needs a matching }}".to_owned();
        add_problem(TemplateProblemSeverity::Error, message, brace_offset);
    }
    if should_warn_undefined {
        for (message, byte_offset) in
            find_undefined_paths(template_text, template_context, function_names)
        {
            add_problem(TemplateProblemSeverity::Warning, message, byte_offset);
        }
    }
    problems
}
