use std::sync::Arc;

use sendmock_core::{
    FixedClock, SeededRandomSource, StandardTemplateFunctions, TemplateRenderMode,
};
use sendmock_ops::{
    AppEvent, ResolvedVariables, build_event_template_context, resolve_template_variables,
};
use sendmock_store::WebhookVariableRecord;
use serde_json::{Map, Value, json};

fn stored_variable(variable_name: &str, kind: &str, value: &str) -> WebhookVariableRecord {
    WebhookVariableRecord {
        variable_id: format!("var_{variable_name}"),
        name: variable_name.to_owned(),
        kind: kind.to_owned(),
        endpoint_id: None,
        value: value.to_owned(),
        random_mode: (kind == "random").then(|| "per_send".to_owned()),
        fixed_value: None,
        description: String::new(),
        created_by: "api".to_owned(),
        created_at_unix_ms: 0,
    }
}

fn endpoint_variable(variable_name: &str, value: &str) -> WebhookVariableRecord {
    WebhookVariableRecord {
        endpoint_id: Some("endpoint_1".to_owned()),
        ..stored_variable(variable_name, "text", value)
    }
}

fn resolve(
    stored_variables: &[WebhookVariableRecord],
    send_time_values: Value,
    render_mode: TemplateRenderMode,
) -> ResolvedVariables {
    let template_functions = StandardTemplateFunctions::new(
        Arc::new(FixedClock::new(1_767_225_600_000)),
        Arc::new(SeededRandomSource::new(4)),
    );
    let email_event = AppEvent {
        id: "evt_1".to_owned(),
        event_type: "email.received".to_owned(),
        created_at: "2026-01-01T00:00:00Z".to_owned(),
        data: json!({ "subject": "Welcome", "to": [{ "name": "Ann", "address": "Ann@Example.com" }] }),
    };
    let base_context = Value::Object(build_event_template_context(&email_event));
    let send_time_values: Map<String, Value> =
        send_time_values.as_object().cloned().unwrap_or_default();
    resolve_template_variables(
        stored_variables,
        &send_time_values,
        &base_context,
        &template_functions,
        render_mode,
    )
}

// AC: WH-07.1
#[test]
fn every_kind_resolves_to_its_value() {
    let fixed_nonce = WebhookVariableRecord {
        random_mode: Some("fixed".to_owned()),
        fixed_value: Some("kept-value".to_owned()),
        ..stored_variable("fixed_nonce", "random", "random_string(8)")
    };
    let stored_variables = vec![
        stored_variable("tenant_id", "text", "acme"),
        stored_variable("priority", "number", "5"),
        stored_variable("sandbox", "boolean", "true"),
        stored_variable("meta", "json", r#"{"env":"local"}"#),
        stored_variable("api_token", "secret", "sk_live_51234"),
        stored_variable("recipient", "dynamic", "email.to[0].address | lower"),
        stored_variable("nonce", "random", "random_string(12)"),
        fixed_nonce,
        stored_variable(
            "full_ref",
            "computed",
            "{{ vars.tenant_id }}-{{ vars.priority }}-{{ event.type }}",
        ),
        stored_variable("reason", "prompt", "manual test"),
    ];

    let resolved = resolve(&stored_variables, json!({}), TemplateRenderMode::Strict);

    let values = resolved.values;
    assert!(resolved.problems.is_empty());
    assert_eq!(values["tenant_id"], "acme");
    assert_eq!(values["priority"], 5);
    assert_eq!(values["sandbox"], true);
    assert_eq!(values["meta"], json!({ "env": "local" }));
    assert_eq!(values["api_token"], "sk_live_51234");
    assert_eq!(values["recipient"], "ann@example.com");
    assert_eq!(values["nonce"].as_str().map(str::len), Some(12));
    assert_eq!(values["fixed_nonce"], "kept-value");
    assert_eq!(values["full_ref"], "acme-5-email.received");
    assert_eq!(values["reason"], "manual test");
}

// AC: WH-07.2
#[test]
fn send_time_values_beat_endpoint_variables_which_beat_global_ones() {
    let stored_variables = vec![
        stored_variable("tenant_id", "text", "global-tenant"),
        endpoint_variable("tenant_id", "endpoint-tenant"),
        stored_variable("region", "text", "global-region"),
        endpoint_variable("plan", "endpoint-plan"),
        stored_variable("reason", "prompt", "manual test"),
    ];

    let automatic_send = resolve(&stored_variables, json!({}), TemplateRenderMode::Strict);
    let manual_send = resolve(
        &stored_variables,
        json!({ "tenant_id": "typed-tenant", "reason": "checking retries", "extra": 1 }),
        TemplateRenderMode::Strict,
    );

    assert_eq!(automatic_send.values["tenant_id"], "endpoint-tenant");
    assert_eq!(automatic_send.values["region"], "global-region");
    assert_eq!(automatic_send.values["plan"], "endpoint-plan");
    assert_eq!(automatic_send.values["reason"], "manual test");
    assert_eq!(manual_send.values["tenant_id"], "typed-tenant");
    assert_eq!(manual_send.values["reason"], "checking retries");
    assert_eq!(manual_send.values["extra"], 1);
}

// AC: WH-07.5
#[test]
fn a_variable_that_cannot_resolve_is_reported_by_name() {
    let stored_variables = vec![stored_variable(
        "recipient",
        "computed",
        "{{ data.missing.address }}",
    )];

    let strict_resolution = resolve(&stored_variables, json!({}), TemplateRenderMode::Strict);
    let lenient_resolution = resolve(&stored_variables, json!({}), TemplateRenderMode::Lenient);

    assert_eq!(strict_resolution.values["recipient"], Value::Null);
    assert_eq!(
        strict_resolution
            .problems
            .first()
            .map(|problem| problem.message.as_str()),
        Some("vars.recipient: Undefined variable: data.missing.address")
    );
    assert_eq!(lenient_resolution.values["recipient"], "");
    assert!(lenient_resolution.problems.is_empty());
}
