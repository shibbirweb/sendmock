#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use sendmock_ops::build_operation_registry;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const STACKS: [&str; 17] = [
    "laravel", "node", "python", "go", "java", "ruby", "dotnet", "curl", "php", "express",
    "nestjs", "django", "flask", "fastapi", "spring", "rails", "aspnet",
];
const CHANNELS: [&str; 4] = ["email", "http", "mailgun", "twilio"];
/// Commands the binary runs itself rather than through an operation.
const BINARY_COMMANDS: [&str; 4] = ["serve", "mcp", "version", "help"];

/// The words of each CLI command before its arguments: `webhook var list` from
/// `sendmock webhook var list`, `preset` from `sendmock preset <presetName>`.
fn list_command_words() -> Vec<Vec<String>> {
    let mut command_words: Vec<Vec<String>> = build_operation_registry()
        .operations()
        .iter()
        .map(|operation| {
            operation
                .definition()
                .cli_usage
                .split_whitespace()
                .skip(1)
                .take_while(|word| !word.starts_with(['<', '-', '[']))
                .map(str::to_owned)
                .collect::<Vec<String>>()
        })
        .filter(|words| !words.is_empty())
        .collect();
    command_words.extend(BINARY_COMMANDS.map(|command| vec![command.to_owned()]));
    command_words
}

/// Every `sendmock <words>` the text prints, as the words that follow `sendmock`.
fn find_printed_commands(text: &str) -> Vec<Vec<String>> {
    let mut printed_commands = Vec::new();
    for (match_index, _) in text.match_indices("sendmock ") {
        let preceding_character = text[..match_index].chars().last();
        if preceding_character.is_some_and(|character| {
            character.is_ascii_alphanumeric() || "_-./".contains(character)
        }) {
            continue;
        }
        let mut words = Vec::new();
        for token in text[match_index + "sendmock ".len()..].split(' ') {
            let word = token.trim_end_matches(['`', '.', ',', ')', ';', ':', '\n']);
            let is_command_word = word
                .chars()
                .next()
                .is_some_and(|character| character.is_ascii_lowercase())
                && word.chars().all(|character| {
                    character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
                });
            if !is_command_word {
                break;
            }
            words.push(word.to_owned());
            if word.len() != token.len() {
                break;
            }
        }
        if !words.is_empty() {
            printed_commands.push(words);
        }
    }
    printed_commands
}

fn find_unknown_commands(text: &str, command_words: &[Vec<String>]) -> Vec<String> {
    find_printed_commands(text)
        .into_iter()
        .filter(|printed_words| {
            !command_words
                .iter()
                .any(|words| printed_words.starts_with(words))
        })
        .map(|printed_words| format!("sendmock {}", printed_words.join(" ")))
        .collect()
}

// AC: AI-08.5
#[tokio::test]
async fn every_command_the_snippets_and_presets_print_is_a_cli_command() {
    let (app_router, _) = build_test_app();
    let command_words = list_command_words();
    let mut printed_texts: Vec<(String, Value)> = Vec::new();
    for stack in STACKS {
        for channel in CHANNELS {
            let snippet_path = format!("/api/v1/integrations/{stack}?channel={channel}");
            let (status, snippet) = call_api(&app_router, "GET", &snippet_path, None).await;
            assert_eq!(status, 200, "{snippet_path}: {snippet}");
            printed_texts.push((snippet_path, snippet));
        }
    }
    let (_, presets) = call_api(&app_router, "GET", "/api/v1/presets", None).await;
    printed_texts.push(("presets".to_owned(), presets));
    let (apply_status, applied) = call_api(
        &app_router,
        "POST",
        "/api/v1/presets/laravel-mailgun-twilio/apply",
        Some(&json!({ "app_url": "http://localhost:8000" })),
    )
    .await;
    assert_eq!(apply_status, 200, "{applied}");
    printed_texts.push(("preset apply".to_owned(), applied));

    let unknown_commands: Vec<String> = printed_texts
        .iter()
        .flat_map(|(source, printed)| {
            find_unknown_commands(&printed.to_string().replace("\\n", "\n"), &command_words)
                .into_iter()
                .map(move |command| format!("{source}: {command}"))
        })
        .collect();

    assert_eq!(unknown_commands, Vec::<String>::new());
    let mailgun_snippet = &printed_texts
        .iter()
        .find(|(source, _)| source == "/api/v1/integrations/laravel?channel=mailgun")
        .map(|(_, snippet)| snippet.to_string())
        .unwrap_or_default();
    assert!(
        mailgun_snippet.contains("sendmock webhook var list"),
        "{mailgun_snippet}"
    );
}

#[test]
fn a_misspelled_command_is_reported() {
    let command_words = vec![vec![
        "webhook".to_owned(),
        "var".to_owned(),
        "list".to_owned(),
    ]];

    assert_eq!(
        find_unknown_commands(
            "the key (sendmock webhooks variables list). Then `sendmock webhook var list`.",
            &command_words
        ),
        vec!["sendmock webhooks variables list".to_owned()]
    );
}
