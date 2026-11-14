#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use support::webhook_samples::create_endpoint;

const VARIABLES_PATH: &str = "/api/v1/webhooks/variables";

fn variable_input(variable_name: &str, kind: &str, value: &str) -> Value {
    json!({
        "name": variable_name,
        "kind": kind,
        "scope": "global",
        "endpoint_id": null,
        "value": value,
        "random_mode": if kind == "random" { json!("per_send") } else { Value::Null },
        "description": "",
    })
}

fn with_fields(mut variable_body: Value, changed_fields: Value) -> Value {
    if let (Some(body_fields), Some(changed_entries)) =
        (variable_body.as_object_mut(), changed_fields.as_object())
    {
        body_fields.extend(changed_entries.clone());
    }
    variable_body
}

async fn create_variable(app_router: &axum::Router, variable_body: &Value) -> Value {
    let (status, created_variable) =
        call_api(app_router, "POST", VARIABLES_PATH, Some(variable_body)).await;
    assert_eq!(status, 201, "{created_variable}");
    created_variable
}

// AC: WH-07.11
// AC: WH-07.12
#[tokio::test]
async fn variables_list_with_scope_and_kind_and_secrets_stay_masked() {
    let (app_router, _) = build_test_app();
    let endpoint_id = create_endpoint(&app_router, "Orders app").await;
    create_variable(&app_router, &variable_input("tenant_id", "text", "acme")).await;
    let secret_variable = create_variable(
        &app_router,
        &variable_input("api_token", "secret", "sk_live_51234"),
    )
    .await;
    let endpoint_variable = create_variable(
        &app_router,
        &with_fields(
            variable_input("region", "text", "eu"),
            json!({ "scope": "endpoint", "endpoint_id": endpoint_id }),
        ),
    )
    .await;

    let (_, every_variable) = call_api(&app_router, "GET", VARIABLES_PATH, None).await;
    let (_, endpoint_variables) = call_api(
        &app_router,
        "GET",
        &format!("{VARIABLES_PATH}?endpoint_id={endpoint_id}"),
        None,
    )
    .await;

    assert_eq!(secret_variable["value"], "••••1234");
    assert_eq!(endpoint_variable["scope"], "endpoint");
    let listed_names: Vec<&str> = every_variable
        .as_array()
        .map(|variables| {
            variables
                .iter()
                .filter_map(|variable| variable["name"].as_str())
                .collect()
        })
        .unwrap_or_default();
    assert_eq!(listed_names, vec!["api_token", "tenant_id", "region"]);
    assert_eq!(endpoint_variables.as_array().map(Vec::len), Some(1));
}

/// Each refused body, the field the error names and its message.
fn refused_variable_inputs() -> Vec<(Value, &'static str, &'static str)> {
    vec![
        (
            variable_input("Tenant", "text", "acme"),
            "name",
            "Use lowercase letters, digits and underscores, starting with a letter",
        ),
        (
            variable_input("priority", "number", "high"),
            "value",
            "Enter a number",
        ),
        (
            variable_input("sandbox", "boolean", "yes"),
            "value",
            "Use true or false",
        ),
        (
            variable_input("meta", "json", "{nope"),
            "value",
            "Enter valid JSON",
        ),
        (
            variable_input("recipient", "dynamic", "shout()"),
            "value",
            "Unknown function: shout",
        ),
        (
            with_fields(
                variable_input("nonce", "random", "uuid()"),
                json!({ "random_mode": null }),
            ),
            "random_mode",
            "Pick Per send or Fixed",
        ),
        (
            with_fields(
                variable_input("region", "text", "eu"),
                json!({ "scope": "endpoint" }),
            ),
            "endpoint_id",
            "Pick an endpoint",
        ),
    ]
}

// AC: WH-07.12
#[tokio::test]
async fn each_kind_is_checked_like_the_variable_sheet_checks_it() {
    let (app_router, _) = build_test_app();
    let refused_inputs = refused_variable_inputs();

    for (refused_input, wrong_field, message) in refused_inputs {
        let (status, error_answer) =
            call_api(&app_router, "POST", VARIABLES_PATH, Some(&refused_input)).await;

        assert_eq!(status, 400, "{refused_input}");
        assert_eq!(
            error_answer["error"]["field"], wrong_field,
            "{error_answer}"
        );
        assert_eq!(error_answer["error"]["message"], message, "{error_answer}");
    }
}

// AC: WH-07.12
#[tokio::test]
async fn names_are_unique_per_scope_and_an_empty_secret_keeps_the_stored_one() {
    let (app_router, operation_context) = build_test_app();
    let secret_variable = create_variable(
        &app_router,
        &variable_input("api_token", "secret", "sk_live_51234"),
    )
    .await;
    let secret_path = format!(
        "{VARIABLES_PATH}/{}",
        secret_variable["id"].as_str().unwrap_or_default()
    );

    let (duplicate_status, duplicate_error) = call_api(
        &app_router,
        "POST",
        VARIABLES_PATH,
        Some(&variable_input("api_token", "text", "x")),
    )
    .await;
    let (edit_status, edited_variable) = call_api(
        &app_router,
        "PATCH",
        &secret_path,
        Some(&with_fields(
            variable_input("api_token", "secret", ""),
            json!({ "description": "Orders API" }),
        )),
    )
    .await;
    let stored_variables = operation_context
        .webhook_variable_repository
        .list_variables(None)
        .await
        .unwrap_or_default();

    assert_eq!(duplicate_status, 400);
    assert_eq!(
        duplicate_error["error"]["message"],
        "A variable with this name already exists here"
    );
    assert_eq!(edit_status, 200, "{edited_variable}");
    assert_eq!(edited_variable["description"], "Orders API");
    assert_eq!(stored_variables[0].value, "sk_live_51234");
}

fn fixed_random_input(description: &str) -> Value {
    with_fields(
        variable_input("nonce", "random", "random_string(24)"),
        json!({ "random_mode": "fixed", "description": description }),
    )
}

async fn regenerate_variable(app_router: &axum::Router, variable: &Value) -> (u16, Value) {
    let variable_id = variable["id"].as_str().unwrap_or_default();
    let regenerate_path = format!("{VARIABLES_PATH}/{variable_id}/regenerate");
    call_api(app_router, "POST", &regenerate_path, None).await
}

// AC: WH-07.4
// AC: WH-07.13
#[tokio::test]
async fn a_fixed_random_value_stays_until_it_is_regenerated() {
    let (app_router, _) = build_test_app();
    let fixed_variable = create_variable(&app_router, &fixed_random_input("")).await;
    let variable_id = fixed_variable["id"].as_str().unwrap_or_default();
    let variable_path = format!("{VARIABLES_PATH}/{variable_id}");

    let (_, renamed_variable) = call_api(
        &app_router,
        "PATCH",
        &variable_path,
        Some(&fixed_random_input("Idempotency key")),
    )
    .await;
    let (_, regenerated_variable) = regenerate_variable(&app_router, &fixed_variable).await;

    let fixed_value = &fixed_variable["fixed_value"];
    assert_eq!(fixed_value.as_str().map(str::len), Some(24));
    assert_eq!(&renamed_variable["fixed_value"], fixed_value);
    assert_ne!(&regenerated_variable["fixed_value"], fixed_value);
    assert_eq!(
        regenerated_variable["fixed_value"].as_str().map(str::len),
        Some(24)
    );
}

// AC: WH-07.13
#[tokio::test]
async fn only_a_fixed_random_variable_can_be_regenerated() {
    let (app_router, _) = build_test_app();
    let text_variable =
        create_variable(&app_router, &variable_input("tenant_id", "text", "acme")).await;

    let (conflict_status, conflict_error) = regenerate_variable(&app_router, &text_variable).await;

    assert_eq!(conflict_status, 409);
    assert_eq!(conflict_error["error"]["code"], "not_fixed_random");
}

// AC: WH-07.12
#[tokio::test]
async fn the_preview_resolves_a_definition_against_the_sample() {
    let (app_router, _) = build_test_app();
    create_variable(&app_router, &variable_input("tenant_id", "text", "acme")).await;
    let preview = |kind: &str, value: &str| json!({ "kind": kind, "value": value });

    let (_, dynamic_preview) = call_api(
        &app_router,
        "POST",
        &format!("{VARIABLES_PATH}/preview"),
        Some(&preview("dynamic", "data.to[0].address | upper")),
    )
    .await;
    let (_, computed_preview) = call_api(
        &app_router,
        "POST",
        &format!("{VARIABLES_PATH}/preview"),
        Some(&preview(
            "computed",
            "{{ vars.tenant_id }}-{{ vars.missing }}",
        )),
    )
    .await;
    let (_, secret_preview) = call_api(
        &app_router,
        "POST",
        &format!("{VARIABLES_PATH}/preview"),
        Some(&preview("secret", "sk_live_51234")),
    )
    .await;
    let (_, broken_preview) = call_api(
        &app_router,
        "POST",
        &format!("{VARIABLES_PATH}/preview"),
        Some(&preview("random", "shout()")),
    )
    .await;

    assert_eq!(
        dynamic_preview,
        json!({ "resolved_value": "ANN@EXAMPLE.COM", "warnings": [], "errors": [] })
    );
    assert_eq!(
        computed_preview,
        json!({ "resolved_value": "acme-", "warnings": ["Undefined variable: vars.missing"], "errors": [] })
    );
    assert_eq!(secret_preview["resolved_value"], "••••••••");
    assert_eq!(broken_preview["errors"], json!(["Unknown function: shout"]));
}
