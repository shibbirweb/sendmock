#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::fs;
use std::path::PathBuf;

use sendmock_ops::{
    CURRENT_FORMAT_VERSION, OperationContext, SetupFileFormat, apply_setup_text,
    build_setup_json_schema, check_setup_text, read_setup_document, write_setup_text,
};
use serde_json::Value;
use support::test_app::build_test_app;

/// Items in sections of every kind of shape: the settings table, nested lists, a list inside
/// an item, inline tables and a scenario's steps.
const SAMPLE_SETUP: &str = r#"[sendmock]
format = "sendmock.setup"
format_version = 2

[settings]
max_emails = 250
sms_failure_rate_percent = 5

[[verify.services]]
sid = "VA00000000000000000000000000000001"
name = "Login"
fixed_code = "123456"

[[numbers]]
number = "+15550001111"
label = "Support line"

[[http.bins]]
name = "stripe"
preset = "generic"

[[http.bins.responses]]
id = "rule_rate_limited"
name = "Rate limited"
is_enabled = true
path_glob = "/v1/*"
delay_min_ms = 0
delay_max_ms = 0
failure_rate_percent = 0
failure_status_code = 500

[http.bins.responses.response]
status_code = 429
body = "slow down"

[[email.tag_rules]]
name = "Invoices"
tag = "billing"
filter = { field = "subject", operator = "contains", value = "Invoice" }

[[email.inbound_routes]]
description = "Support inbox"
priority = 1
filter = { kind = "match_recipient", pattern = "^support@.*" }
actions = [{ kind = "forward_url", url = "http://localhost:8000/inbound" }, { kind = "stop" }]

[[scenarios]]
name = "Inbox check"
description = "Lists the inbox and checks it answered"

[[scenarios.steps]]
run = "email.list"
save = "inbox"
"#;

async fn apply_in(
    operation_context: &OperationContext,
    setup_text: &str,
    setup_format: SetupFileFormat,
) {
    apply_setup_text(operation_context, setup_text, setup_format, None)
        .await
        .unwrap_or_else(|error| panic!("{setup_format:?} applies: {error}\n{setup_text}"));
}

async fn export_in(operation_context: &OperationContext, setup_format: SetupFileFormat) -> String {
    write_setup_text(operation_context, setup_format)
        .await
        .unwrap_or_else(|error| panic!("{setup_format:?} exports: {error}"))
}

/// An export of `SAMPLE_SETUP` from a fresh instance, in the chosen format.
async fn export_sample_setup(setup_format: SetupFileFormat) -> String {
    let (_, operation_context) = build_test_app();
    apply_in(&operation_context, SAMPLE_SETUP, SetupFileFormat::Toml).await;
    export_in(&operation_context, setup_format).await
}

fn read_as_json(setup_text: &str, setup_format: SetupFileFormat) -> Value {
    match setup_format {
        SetupFileFormat::Json => serde_json::from_str(setup_text)
            .unwrap_or_else(|error| panic!("the JSON export reads: {error}")),
        SetupFileFormat::Yaml => serde_yaml_ng::from_str(setup_text)
            .unwrap_or_else(|error| panic!("the YAML export reads: {error}")),
        SetupFileFormat::Toml => {
            let setup_table = read_setup_document(setup_text, SetupFileFormat::Toml)
                .unwrap_or_else(|problem| panic!("the TOML export reads: {problem:?}"));
            serde_json::to_value(setup_table)
                .unwrap_or_else(|error| panic!("the TOML export converts: {error}"))
        }
    }
}

fn committed_schema_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../website/public/schema/setup")
        .join(format!("v{CURRENT_FORMAT_VERSION}.json"))
}

// AC: PL-18.5
#[tokio::test]
async fn a_json_or_yaml_export_moves_the_setup_to_a_fresh_instance_without_loss() {
    let toml_export = export_sample_setup(SetupFileFormat::Toml).await;

    for setup_format in [SetupFileFormat::Json, SetupFileFormat::Yaml] {
        let other_export = export_sample_setup(setup_format).await;
        let (_, fresh_context) = build_test_app();
        apply_in(&fresh_context, &other_export, setup_format).await;

        assert_eq!(
            export_in(&fresh_context, SetupFileFormat::Toml).await,
            toml_export,
            "{setup_format:?} export:\n{other_export}"
        );
        assert_eq!(
            read_as_json(&other_export, setup_format),
            read_as_json(&toml_export, SetupFileFormat::Toml),
            "{setup_format:?} holds the same structure as TOML"
        );
    }
}

// AC: PL-18.5
#[tokio::test]
async fn a_json_or_yaml_file_is_checked_by_the_same_rules_and_applies_nothing_when_invalid() {
    let (_, operation_context) = build_test_app();
    let broken_yaml = "numbers:\n  - number: \"+15550001111\"\n    label: Support\nwebhook:\n  endpoint:\n    - name: typo\n";

    let setup_check = check_setup_text(broken_yaml, SetupFileFormat::Yaml);
    let apply_result =
        apply_setup_text(&operation_context, broken_yaml, SetupFileFormat::Yaml, None).await;

    assert!(!setup_check.is_valid());
    assert_eq!(
        setup_check.problems[0].location.as_deref(),
        Some("webhook.endpoint")
    );
    let apply_error = apply_result
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
    assert!(
        apply_error.contains("webhook.endpoint: Unknown section"),
        "{apply_error}"
    );
    let numbers_export = export_in(&operation_context, SetupFileFormat::Toml).await;
    assert!(!numbers_export.contains("+15550001111"), "{numbers_export}");
}

// AC: PL-18.5
#[tokio::test]
async fn every_export_format_passes_the_setup_json_schema() {
    let setup_schema = build_setup_json_schema();
    let validator = jsonschema::draft202012::new(&setup_schema)
        .unwrap_or_else(|error| panic!("the setup schema compiles: {error}"));

    for setup_format in SetupFileFormat::ALL {
        let exported_setup = read_as_json(&export_sample_setup(setup_format).await, setup_format);
        let schema_errors: Vec<String> = validator
            .iter_errors(&exported_setup)
            .map(|validation_error| {
                format!(
                    "{} at {}",
                    validation_error,
                    validation_error.instance_path()
                )
            })
            .collect();
        assert!(
            schema_errors.is_empty(),
            "{setup_format:?}: {schema_errors:?}\n{exported_setup:#}"
        );
    }
    let typo_setup = serde_json::json!({
        "sendmock": { "format": "sendmock.setup", "format_version": CURRENT_FORMAT_VERSION },
        "numbers": [{ "number": "+15550001111", "labl": "typo" }],
    });
    assert!(!validator.is_valid(&typo_setup));
}

// AC: PL-18.5
#[test]
fn the_published_setup_schema_matches_this_build() {
    let rendered_schema = format!(
        "{}\n",
        serde_json::to_string_pretty(&build_setup_json_schema())
            .unwrap_or_else(|error| panic!("the schema writes: {error}"))
    );
    let schema_path = committed_schema_path();
    if std::env::var("SENDMOCK_UPDATE_SCHEMA").as_deref() == Ok("1") {
        if let Some(schema_folder) = schema_path.parent() {
            fs::create_dir_all(schema_folder).unwrap_or_else(|error| panic!("{error}"));
        }
        fs::write(&schema_path, &rendered_schema).unwrap_or_else(|error| panic!("{error}"));
        return;
    }
    // A Windows checkout may turn the committed file's line endings into CRLF.
    let committed_schema = fs::read_to_string(&schema_path)
        .unwrap_or_default()
        .replace("\r\n", "\n");
    assert!(
        committed_schema == rendered_schema,
        "website/public/schema/setup/v{CURRENT_FORMAT_VERSION}.json is out of date: run \
         `SENDMOCK_UPDATE_SCHEMA=1 cargo test -p sendmock-api --test setup_file_formats_api` \
         and commit it. The schema this build writes:\n{rendered_schema}"
    );
}
