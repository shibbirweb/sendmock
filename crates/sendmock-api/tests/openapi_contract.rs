use std::collections::{BTreeSet, HashMap};
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use sendmock_api::{UiAsset, UiAssets, build_app_router, build_openapi_document};
use sendmock_core::FixedClock;
use sendmock_ops::{
    AnswerKind, AppEvent, AppSettingsUpdate, DeliveryOrder, DeliveryTrigger, InstanceDetails,
    MessageProviderInput, OperationContext, OperationRegistry, ReleaseChannel, SampleEmail,
    SampleEmailSender, SmtpMessage, SuccessStatus, UpdateCheckMode, build_operation_registry,
    builtin_sms_providers, enqueue_webhook_delivery, run_due_deliveries, store_smtp_message,
};
use sendmock_store::{
    ApiRequestFilter, Database, DatabaseLocation, EMBEDDED_MIGRATIONS, SmtpSessionRecord,
};
use serde_json::{Value, json};
use tower::ServiceExt;

const FROZEN_CONTRACT_PATH: &str =
    concat!(env!("CARGO_MANIFEST_DIR"), "/../../docs/api/openapi.yaml");

struct NoUiAssets;

impl UiAssets for NoUiAssets {
    fn find_asset(&self, _asset_path: &str) -> Option<UiAsset> {
        None
    }
}

/// A small PNG (one pixel), base64 encoded, so image attachments have real bytes.
const ONE_PIXEL_PNG_BASE64: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async fn post_json(app_router: &axum::Router, path: &str, body: &Value) -> Value {
    send_json(app_router, "POST", path, body).await
}

async fn send_json(app_router: &axum::Router, method: &str, path: &str, body: &Value) -> Value {
    let request = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    serde_json::from_slice(&body_bytes).unwrap_or_else(|error| panic!("a JSON answer: {error}"))
}

fn native_send_sample() -> Value {
    json!({
        "from": "Shop <no-reply@shop.test>",
        "to": ["sam@example.test"],
        "bcc": ["audit@shop.test"],
        "subject": "Your code",
        "text": "Your verification code is 482913. Visit https://shop.test/confirm?t=1",
        "html": "<p>Your verification code is <b>482913</b>.</p>",
        "headers": { "List-Unsubscribe": "<https://shop.test/unsubscribe>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        "tags": ["signup"],
        "attachments": [{ "filename": "logo.png", "content": ONE_PIXEL_PNG_BASE64 }]
    })
}

/// Health, info, seed, settings, samples, integrations and events: no item needed first.
fn system_samples() -> Vec<(&'static str, Vec<Value>)> {
    vec![
        ("getHealth", vec![json!({})]),
        ("getInfo", vec![json!({})]),
        (
            "postSeedValidate",
            vec![
                json!({ "seed_toml": "[[numbers]]\nnumber = \"+15550001111\"\n" }),
                json!({ "seed_toml": "[[mystery]]\nkey = 1\n" }),
            ],
        ),
        ("getSettings", vec![json!({})]),
        (
            "patchSettings",
            vec![
                json!({ "max_emails": 500, "max_age_days": null, "relay_smtp_url": "smtp://mailer:s3cret@relay.test:587" }),
            ],
        ),
        ("postReset", vec![json!({})]),
        (
            "postSamplesByKind",
            vec![
                json!({ "kind": "email", "to": "sam@example.test", "subject": "Sample" }),
                json!({ "kind": "verification" }),
            ],
        ),
        (
            "getIntegrationsByStack",
            vec![
                json!({ "stack": "laravel" }),
                json!({ "stack": "django", "channel": "http", "host": "compose" }),
            ],
        ),
        (
            "getEventsRecent",
            vec![
                json!({}),
                json!({ "type": "email.received", "since": "2025-01-01T00:00:00Z", "limit": 5 }),
            ],
        ),
    ]
}

/// Inputs per operation, sent through the router; an operation without samples fails the
/// answer test, so every new operation brings some. Samples that need an item create it
/// first through the API.
async fn prepare_sample_inputs(
    app_router: &axum::Router,
    operation_context: &OperationContext,
) -> HashMap<&'static str, Vec<Value>> {
    let mut samples: HashMap<&'static str, Vec<Value>> = system_samples().into_iter().collect();
    samples.extend(prepare_email_samples(app_router).await);
    samples.extend(prepare_log_samples(operation_context).await);
    samples.extend(prepare_update_samples(operation_context).await);
    samples.extend(prepare_sms_samples(app_router).await);
    samples.extend(prepare_outcome_rule_samples(app_router).await);
    samples.extend(prepare_number_samples(app_router).await);
    samples.extend(prepare_verify_samples(app_router).await);
    samples.extend(prepare_sms_provider_samples(app_router).await);
    samples.extend(prepare_webhook_endpoint_samples(app_router).await);
    samples.extend(prepare_webhook_delivery_samples(app_router, operation_context).await);
    samples.extend(prepare_webhook_rule_samples(app_router).await);
    samples.extend(prepare_webhook_variable_samples(app_router).await);
    samples.extend([webhook_preview_samples()]);
    samples.extend(prepare_webhook_template_samples(app_router).await);
    samples
}

/// A shipped SMS provider's settings, as `PATCH` and the preview take them.
fn sms_provider_input(provider_key: &str) -> Value {
    builtin_sms_providers()
        .into_iter()
        .find(|provider| provider.key == provider_key)
        .map(|provider| serde_json::to_value(MessageProviderInput::from(provider)))
        .and_then(Result::ok)
        .unwrap_or_else(|| panic!("{provider_key} is shipped"))
}

/// MessageBird removed first, so restoring it applies; Plivo is the one the delete sample removes.
async fn prepare_sms_provider_samples(
    app_router: &axum::Router,
) -> Vec<(&'static str, Vec<Value>)> {
    let removal = Request::delete("/api/v1/sms/providers/messagebird")
        .body(Body::empty())
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    app_router
        .clone()
        .oneshot(removal)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let mut vonage_update = sms_provider_input("vonage");
    vonage_update["provider_key"] = json!("vonage");
    let twilio_send = json!({
        "method": "POST",
        "path": "/2010-04-01/Accounts/ACtest00000000000000000000000000/Messages.json",
        "headers": { "content-type": "application/x-www-form-urlencoded" },
        "body": "To=%2B15551234567&From=%2B15005550006&Body=Hi",
    });
    vec![
        ("getSmsProviders", vec![json!({})]),
        (
            "getSmsProvidersByProviderKey",
            vec![json!({ "provider_key": "twilio" })],
        ),
        ("patchSmsProvidersByProviderKey", vec![vonage_update]),
        (
            "postSmsProvidersByProviderKeyRestore",
            vec![json!({ "provider_key": "messagebird" })],
        ),
        (
            "postSmsProvidersByProviderKeyReset",
            vec![json!({ "provider_key": "twilio" })],
        ),
        (
            "postSmsProvidersByProviderKeyPreview",
            vec![
                json!({ "provider_key": "twilio", "provider": sms_provider_input("twilio") }),
                json!({ "provider_key": "twilio", "provider": sms_provider_input("twilio"), "sample_request": twilio_send }),
            ],
        ),
        (
            "getSmsProvidersByProviderKeyCredentialsByCredentialName",
            vec![json!({ "provider_key": "twilio", "credential_name": "auth_token" })],
        ),
        (
            "deleteSmsProvidersByProviderKey",
            vec![json!({ "provider_key": "plivo" })],
        ),
    ]
}

fn verify_service_sample() -> Value {
    json!({ "friendly_name": "Shop", "code_length": 6, "fixed_code": "123456", "ttl_seconds": 600 })
}

/// Two Verify services (one to edit, one to delete) and a verification to read and force.
async fn prepare_verify_samples(app_router: &axum::Router) -> Vec<(&'static str, Vec<Value>)> {
    let services_path = "/api/v1/verify/services";
    let edited_service_sid =
        post_json(app_router, services_path, &verify_service_sample()).await["sid"].clone();
    let deleted_service_sid =
        post_json(app_router, services_path, &verify_service_sample()).await["sid"].clone();
    let verification_sid = post_json(
        app_router,
        "/api/v1/samples/verification",
        &json!({ "to": "+14155550111" }),
    )
    .await["id"]
        .clone();
    let mut service_update = verify_service_sample();
    service_update["service_sid"] = edited_service_sid;
    vec![
        (
            "getVerify",
            vec![
                json!({}),
                json!({ "status": "pending,approved", "to": "+1415", "channel": "sms", "limit": 5 }),
            ],
        ),
        (
            "getVerifyByVerificationSid",
            vec![json!({ "verification_sid": verification_sid })],
        ),
        (
            "postVerifyByVerificationSidForce",
            vec![json!({ "verification_sid": verification_sid, "state": "approved" })],
        ),
        ("getVerifyServices", vec![json!({})]),
        ("postVerifyServices", vec![verify_service_sample()]),
        ("patchVerifyServicesByServiceSid", vec![service_update]),
        (
            "deleteVerifyServicesByServiceSid",
            vec![json!({ "service_sid": deleted_service_sid })],
        ),
    ]
}

fn virtual_number_sample(e164_number: &str) -> Value {
    json!({
        "number": e164_number, "label": "Support line", "channels": ["sms"],
        "inbound_url": "http://localhost:3000/sms/inbound", "inbound_method": "POST",
        "inbound_fallback_url": null, "inbound_template_id": null,
        "status_callback_url": null, "messaging_service_sid": null,
    })
}

fn messaging_service_sample(number_ids: &[&Value]) -> Value {
    json!({
        "friendly_name": "Notifications", "number_ids": number_ids,
        "inbound_mode": "webhook", "inbound_url": "http://localhost:3000/sms/inbound",
        "inbound_fallback_url": null,
    })
}

/// Two numbers and two services: one of each to edit, one of each to delete.
async fn prepare_number_samples(app_router: &axum::Router) -> Vec<(&'static str, Vec<Value>)> {
    let edited_number_id = post_json(
        app_router,
        "/api/v1/numbers",
        &virtual_number_sample("+15550001111"),
    )
    .await["id"]
        .clone();
    let deleted_number_id = post_json(
        app_router,
        "/api/v1/numbers",
        &virtual_number_sample("+15550002222"),
    )
    .await["id"]
        .clone();
    let services_path = "/api/v1/messaging-services";
    let edited_service_sid = post_json(
        app_router,
        services_path,
        &messaging_service_sample(&[&edited_number_id]),
    )
    .await["sid"]
        .clone();
    let deleted_service_sid =
        post_json(app_router, services_path, &messaging_service_sample(&[])).await["sid"].clone();
    let mut number_update = virtual_number_sample("+15550001111");
    number_update["number_id"] = edited_number_id.clone();
    let mut service_update = messaging_service_sample(&[&edited_number_id]);
    service_update["service_sid"] = edited_service_sid;
    vec![
        ("getNumbers", vec![json!({})]),
        ("postNumbers", vec![virtual_number_sample("+15550003333")]),
        ("patchNumbersByNumberId", vec![number_update]),
        (
            "deleteNumbersByNumberId",
            vec![json!({ "number_id": deleted_number_id })],
        ),
        ("getMessagingServices", vec![json!({})]),
        ("postMessagingServices", vec![messaging_service_sample(&[])]),
        ("patchMessagingServicesByServiceSid", vec![service_update]),
        (
            "deleteMessagingServicesByServiceSid",
            vec![json!({ "service_sid": deleted_service_sid })],
        ),
    ]
}

fn webhook_endpoint_sample(endpoint_name: &str) -> Value {
    json!({
        "name": endpoint_name, "url": "http://localhost:3000/webhooks/sendmock", "method": "POST",
        "headers": { "X-Source": "sendmock" }, "extra_fields": {}, "template_id": "native",
        "template_mode": "linked", "timeout_ms": 10_000,
        "retry_policy": {
            "max_attempts": 5, "backoff_seconds": [1, 5, 30, 120, 600],
            "retry_on_client_errors": false,
        },
        "is_enabled": true, "query_params": [], "body_mode": "template", "body_fields": [],
        "fields_encoding": "json", "raw_content_type": "application/json", "raw_body": "",
        "render_mode": "strict",
    })
}

/// Two endpoints: one to edit, reveal and rotate, one to delete.
async fn prepare_webhook_endpoint_samples(
    app_router: &axum::Router,
) -> Vec<(&'static str, Vec<Value>)> {
    let path = "/api/v1/webhooks/endpoints";
    let edited_endpoint_id =
        post_json(app_router, path, &webhook_endpoint_sample("Orders app")).await["id"].clone();
    let deleted_endpoint_id =
        post_json(app_router, path, &webhook_endpoint_sample("Old app")).await["id"].clone();
    vec![
        ("getWebhooksEndpoints", vec![json!({})]),
        (
            "postWebhooksEndpoints",
            vec![webhook_endpoint_sample("Billing")],
        ),
        (
            "getWebhooksEndpointsByEndpointId",
            vec![json!({ "endpoint_id": edited_endpoint_id })],
        ),
        (
            "patchWebhooksEndpointsByEndpointId",
            vec![json!({ "endpoint_id": edited_endpoint_id, "is_enabled": false })],
        ),
        (
            "getWebhooksEndpointsByEndpointIdSecret",
            vec![json!({ "endpoint_id": edited_endpoint_id })],
        ),
        (
            "postWebhooksEndpointsByEndpointIdRotateSecret",
            vec![json!({ "endpoint_id": edited_endpoint_id, "overlap_hours": 24 })],
        ),
        (
            "deleteWebhooksEndpointsByEndpointId",
            vec![json!({ "endpoint_id": deleted_endpoint_id })],
        ),
    ]
}

/// Queues one delivery of a sample event to a new endpoint, without sending it.
async fn queue_sample_delivery(
    operation_context: &OperationContext,
    endpoint_id: &str,
    event_id: &str,
) -> String {
    let stored_endpoint = operation_context
        .webhook_endpoint_repository
        .find_endpoint(endpoint_id)
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| panic!("the endpoint {endpoint_id} exists"));
    let delivery_order = DeliveryOrder {
        app_event: AppEvent {
            id: event_id.to_owned(),
            event_type: "email.received".to_owned(),
            created_at: "2026-01-01T00:00:00Z".to_owned(),
            data: json!({ "subject": "Welcome" }),
        },
        subject_id: None,
        rule_id: None,
        delivery_trigger: DeliveryTrigger::Manual,
        send_time_values: serde_json::Map::new(),
    };
    enqueue_webhook_delivery(operation_context, &stored_endpoint, delivery_order)
        .await
        .unwrap_or_else(|error| panic!("the delivery is queued: {error}"))
        .delivery_id
}

/// A finished delivery (sent without an HTTP client, so it fails and waits to retry) for
/// the list, the detail and wait, and a queued one to cancel.
async fn prepare_webhook_delivery_samples(
    app_router: &axum::Router,
    operation_context: &OperationContext,
) -> Vec<(&'static str, Vec<Value>)> {
    let endpoint = post_json(
        app_router,
        "/api/v1/webhooks/endpoints",
        &webhook_endpoint_sample("Deliveries"),
    )
    .await;
    let endpoint_id = endpoint["id"].as_str().unwrap_or_default();
    let sent_delivery_id = queue_sample_delivery(operation_context, endpoint_id, "evt_sent").await;
    run_due_deliveries(operation_context, 8)
        .await
        .unwrap_or_else(|error| panic!("the pass runs: {error}"));
    let queued_delivery_id =
        queue_sample_delivery(operation_context, endpoint_id, "evt_queued").await;
    vec![
        (
            "getWebhooksDeliveries",
            vec![
                json!({}),
                json!({ "status": "failed,pending", "limit": 10 }),
            ],
        ),
        (
            "getWebhooksDeliveriesByDeliveryId",
            vec![json!({ "delivery_id": sent_delivery_id })],
        ),
        (
            "postWebhooksDeliveriesByDeliveryIdCancel",
            vec![json!({ "delivery_id": queued_delivery_id })],
        ),
        (
            "getWaitWebhook",
            vec![json!({ "endpoint": "Deliveries", "event": "email.received", "timeout": "1s" })],
        ),
    ]
}

fn webhook_rule_sample(rule_name: &str, endpoint_id: &Value) -> Value {
    json!({
        "name": rule_name,
        "endpoint_id": endpoint_id,
        "events": ["email.received"],
        "filter": { "all": [{ "field": "to", "operator": "matches", "value": "*@inbound.local" }] },
        "is_enabled": true,
    })
}

async fn create_sample_rule(
    app_router: &axum::Router,
    rule_name: &str,
    endpoint_id: &Value,
) -> Value {
    let rule_sample = webhook_rule_sample(rule_name, endpoint_id);
    post_json(app_router, "/api/v1/webhooks/rules", &rule_sample).await["id"].clone()
}

/// A plain preview, and one whose undefined header and mistyped field report problems.
fn webhook_preview_samples() -> (&'static str, Vec<Value>) {
    let mut endpoint_with_problems = webhook_endpoint_sample("Preview");
    endpoint_with_problems["headers"] = json!({ "X-Missing": "{{ vars.missing }}" });
    endpoint_with_problems["body_mode"] = json!("fields");
    endpoint_with_problems["body_fields"] =
        json!([{ "name": "count", "value_type": "number", "value": "{{ data.subject }}" }]);
    (
        "postWebhooksEndpointsPreview",
        vec![
            json!({ "endpoint": webhook_endpoint_sample("Preview") }),
            json!({ "endpoint": endpoint_with_problems, "variables": { "tenant": "acme" } }),
        ],
    )
}

fn template_draft_sample(body_template: &str) -> Value {
    json!({
        "method": "POST", "content_type": "application/json",
        "header_templates": { "X-Source": "sendmock" }, "body_template": body_template,
    })
}

/// Two custom templates (one to edit, one to delete) and an edited built-in to reset.
async fn prepare_sample_templates(app_router: &axum::Router) -> (Value, Value) {
    let path = "/api/v1/webhooks/templates";
    let edited_id = post_json(app_router, path, &json!({ "name": "Orders" })).await["id"].clone();
    let deleted_id = post_json(app_router, path, &json!({ "name": "Old" })).await["id"].clone();
    let mut slack_edit = template_draft_sample("{\"text\": \"{{ data.subject }}\"}");
    slack_edit["template_id"] = json!("slack.incoming_webhook");
    let edited_slack = send_json(
        app_router,
        "PATCH",
        &format!("{path}/slack.incoming_webhook"),
        &slack_edit,
    )
    .await;
    assert_eq!(edited_slack["is_modified"], true, "{edited_slack}");
    (edited_id, deleted_id)
}

/// A custom template to edit, restore and render, one to delete, and an edited built-in to
/// reset.
async fn prepare_webhook_template_samples(
    app_router: &axum::Router,
) -> Vec<(&'static str, Vec<Value>)> {
    let (edited_id, deleted_id) = prepare_sample_templates(app_router).await;
    let mut custom_edit = template_draft_sample("{\"subject\": \"{{ data.subject }}\"}");
    custom_edit["template_id"] = edited_id.clone();
    custom_edit["required_variables"] = json!(["tenant_id"]);
    let with_draft =
        json!({ "template_id": "native", "draft": template_draft_sample("{{ vars.missing }}") });
    vec![
        ("getWebhooksTemplates", vec![json!({})]),
        (
            "postWebhooksTemplates",
            vec![json!({ "name": "Order webhook" })],
        ),
        (
            "getWebhooksTemplatesByTemplateId",
            vec![
                json!({ "template_id": "twilio.inbound_sms" }),
                json!({ "template_id": edited_id }),
            ],
        ),
        ("patchWebhooksTemplatesByTemplateId", vec![custom_edit]),
        (
            "getWebhooksTemplatesByTemplateIdRevisions",
            vec![json!({ "template_id": edited_id })],
        ),
        (
            "postWebhooksTemplatesByTemplateIdRevisionsByRevisionRestore",
            vec![json!({ "template_id": edited_id, "revision": 1 })],
        ),
        (
            "postWebhooksTemplatesByTemplateIdRender",
            vec![json!({ "template_id": "twilio.inbound_sms" }), with_draft],
        ),
        (
            "postWebhooksTemplatesByTemplateIdReset",
            vec![json!({ "template_id": "slack.incoming_webhook" })],
        ),
        (
            "postWebhooksTemplatesByTemplateIdClone",
            vec![json!({ "template_id": "native", "name": "Native copy" })],
        ),
        (
            "deleteWebhooksTemplatesByTemplateId",
            vec![json!({ "template_id": deleted_id })],
        ),
    ]
}

async fn prepare_webhook_rule_samples(
    app_router: &axum::Router,
) -> Vec<(&'static str, Vec<Value>)> {
    let endpoint_id = post_json(
        app_router,
        "/api/v1/webhooks/endpoints",
        &webhook_endpoint_sample("Rules"),
    )
    .await["id"]
        .clone();
    let edited_rule_id = create_sample_rule(app_router, "Inbound", &endpoint_id).await;
    let deleted_rule_id = create_sample_rule(app_router, "Old rule", &endpoint_id).await;
    vec![
        ("getWebhooksRules", vec![json!({})]),
        (
            "postWebhooksRules",
            vec![webhook_rule_sample("Support", &endpoint_id)],
        ),
        (
            "getWebhooksRulesByRuleId",
            vec![json!({ "rule_id": edited_rule_id })],
        ),
        (
            "patchWebhooksRulesByRuleId",
            vec![json!({ "rule_id": edited_rule_id, "is_enabled": false })],
        ),
        (
            "postWebhooksRulesByRuleIdMove",
            vec![json!({ "rule_id": edited_rule_id, "direction": "down" })],
        ),
        (
            "postWebhooksRulesPreview",
            vec![json!({ "events": ["email.received"], "filter": null })],
        ),
        (
            "deleteWebhooksRulesByRuleId",
            vec![json!({ "rule_id": deleted_rule_id })],
        ),
    ]
}

fn webhook_variable_sample(variable_name: &str, kind: &str, value: &str) -> Value {
    json!({
        "name": variable_name,
        "kind": kind,
        "scope": "global",
        "endpoint_id": null,
        "value": value,
        "random_mode": if kind == "random" { json!("fixed") } else { Value::Null },
        "description": "",
    })
}

async fn prepare_webhook_variable_samples(
    app_router: &axum::Router,
) -> Vec<(&'static str, Vec<Value>)> {
    let path = "/api/v1/webhooks/variables";
    let fixed_variable_id = post_json(
        app_router,
        path,
        &webhook_variable_sample("nonce", "random", "random_string(16)"),
    )
    .await["id"]
        .clone();
    let deleted_variable_id = post_json(
        app_router,
        path,
        &webhook_variable_sample("old_token", "secret", "sk_live_1234"),
    )
    .await["id"]
        .clone();
    let mut edited_variable = webhook_variable_sample("nonce", "random", "random_string(16)");
    edited_variable["variable_id"] = fixed_variable_id.clone();
    vec![
        ("getWebhooksVariables", vec![json!({})]),
        (
            "postWebhooksVariables",
            vec![webhook_variable_sample("tenant_id", "text", "acme")],
        ),
        ("patchWebhooksVariablesByVariableId", vec![edited_variable]),
        (
            "postWebhooksVariablesByVariableIdRegenerate",
            vec![json!({ "variable_id": fixed_variable_id })],
        ),
        (
            "postWebhooksVariablesPreview",
            vec![json!({ "kind": "dynamic", "value": "data.subject" })],
        ),
        (
            "deleteWebhooksVariablesByVariableId",
            vec![json!({ "variable_id": deleted_variable_id })],
        ),
    ]
}

fn sms_outcome_rule_sample(pattern: &str) -> Value {
    json!({
        "match_field": "to", "pattern": pattern, "outcome": "undelivered",
        "error_code": "30007", "delay_seconds": null, "note": "Filtered", "is_enabled": true,
    })
}

/// Two custom outcome numbers: one to edit and move, one to delete.
async fn prepare_outcome_rule_samples(
    app_router: &axum::Router,
) -> Vec<(&'static str, Vec<Value>)> {
    let path = "/api/v1/outcome-rules/sms";
    let edited_rule_id =
        post_json(app_router, path, &sms_outcome_rule_sample("+1555777*")).await["id"].clone();
    let deleted_rule_id =
        post_json(app_router, path, &sms_outcome_rule_sample("+1555888*")).await["id"].clone();
    vec![
        ("getOutcomeRulesSms", vec![json!({})]),
        (
            "postOutcomeRulesSms",
            vec![sms_outcome_rule_sample("+15559990000")],
        ),
        (
            "patchOutcomeRulesSmsByRuleId",
            vec![json!({ "rule_id": edited_rule_id, "is_enabled": false })],
        ),
        (
            "postOutcomeRulesSmsByRuleIdMove",
            vec![json!({ "rule_id": edited_rule_id, "direction": "down" })],
        ),
        (
            "deleteOutcomeRulesSmsByRuleId",
            vec![json!({ "rule_id": deleted_rule_id })],
        ),
        (
            "postOutcomeRulesSmsTest",
            vec![
                json!({ "number": "+15005550001", "match_field": "to" }),
                json!({ "number": "+1555777000", "match_field": "to" }),
            ],
        ),
    ]
}

fn mms_sample() -> Value {
    json!({
        "from": "+15550001111", "to": "+8801700000000", "body": "Your code is 482913",
        "status_callback": "http://127.0.0.1:9/status", "metadata": { "user_id": 42 },
        "media": [{ "filename": "logo.png", "content": ONE_PIXEL_PNG_BASE64 }],
    })
}

/// Two messages, one with media, created through `POST /sms`.
async fn prepare_sms_samples(app_router: &axum::Router) -> Vec<(&'static str, Vec<Value>)> {
    let mms = mms_sample();
    let sms_id = post_json(app_router, "/api/v1/sms", &mms).await["id"].clone();
    let deleted_sms_id = post_json(
        app_router,
        "/api/v1/sms",
        &json!({ "from": "ACME", "to": "+15005550006", "body": "Bye" }),
    )
    .await["id"]
        .clone();
    vec![
        (
            "getSms",
            vec![
                json!({}),
                json!({ "query": "code", "direction": "outbound", "limit": 5 }),
            ],
        ),
        (
            "postSms",
            vec![json!({ "from": "+15550001111", "to": "+8801700000000", "body": "Hello" })],
        ),
        ("getSmsThreads", vec![json!({})]),
        ("getSmsBySmsId", vec![json!({ "sms_id": sms_id })]),
        (
            "getSmsBySmsIdMediaByMediaIndex",
            vec![json!({ "sms_id": sms_id, "media_index": 0 })],
        ),
        (
            "postSmsBySmsIdStatus",
            vec![json!({ "sms_id": sms_id, "status": "delivered" })],
        ),
        (
            "postSmsInbound",
            vec![json!({ "from": "+8801700000000", "to": "+15550001111", "body": "STOP" })],
        ),
        (
            "getWaitSms",
            vec![json!({ "to": "+8801700000000", "timeout": "1s" })],
        ),
        (
            "deleteSmsBySmsId",
            vec![json!({ "sms_id": deleted_sms_id })],
        ),
        ("deleteSms", vec![json!({})]),
    ]
}

/// The update check answers only once it is turned on; this dev build is offered nothing.
async fn prepare_update_samples(
    operation_context: &OperationContext,
) -> Vec<(&'static str, Vec<Value>)> {
    let manual_mode = AppSettingsUpdate {
        update_check_mode: Some(UpdateCheckMode::Manual),
        ..AppSettingsUpdate::default()
    };
    let current_settings = operation_context
        .settings_store
        .current()
        .await
        .unwrap_or_else(|error| panic!("settings: {error}"));
    operation_context
        .settings_store
        .save(manual_mode.apply_to(current_settings), 0)
        .await
        .unwrap_or_else(|error| panic!("settings are saved: {error}"));
    vec![("getUpdates", vec![json!({})])]
}

fn sample_smtp_session() -> SmtpSessionRecord {
    SmtpSessionRecord {
        session_id: "01JSESSION0000000000000000".to_owned(),
        started_at_unix_ms: 1_767_225_600_000,
        ended_at_unix_ms: 1_767_225_600_120,
        remote_address: "127.0.0.1:52144".to_owned(),
        helo_name: "app.test".to_owned(),
        tls_version: Some("TLSv1.3".to_owned()),
        auth_mechanism: None,
        auth_user: None,
        result: "rejected".to_owned(),
        failure_reason: Some("552 Message size exceeds the limit".to_owned()),
        email_ids: Vec::new(),
        transcript: "S: 220 localhost ESMTP SendMock\nC: EHLO app.test".to_owned(),
    }
}

/// An SMTP session stored directly, and one of the API requests the email samples made.
async fn prepare_log_samples(
    operation_context: &OperationContext,
) -> Vec<(&'static str, Vec<Value>)> {
    operation_context
        .smtp_session_repository
        .insert_session(sample_smtp_session())
        .await
        .unwrap_or_else(|error| panic!("a session is stored: {error}"));
    let logged_request_id = operation_context
        .api_request_repository
        .list_requests(ApiRequestFilter::default(), None, 1)
        .await
        .unwrap_or_else(|error| panic!("requests are listed: {error}"))
        .requests
        .first()
        .map(|request| request.request_id.clone())
        .unwrap_or_else(|| panic!("the email samples were logged"));
    vec![
        (
            "getLogsSmtp",
            vec![
                json!({}),
                json!({ "result": "failed", "query": "app", "limit": 5 }),
            ],
        ),
        (
            "getLogsSmtpBySessionId",
            vec![json!({ "session_id": "01JSESSION0000000000000000" })],
        ),
        (
            "getLogsHttp",
            vec![
                json!({}),
                json!({ "api": "native", "status_class": "2xx", "path": "send" }),
            ],
        ),
        (
            "getLogsHttpByRequestId",
            vec![json!({ "request_id": logged_request_id })],
        ),
    ]
}

async fn prepare_email_samples(app_router: &axum::Router) -> Vec<(&'static str, Vec<Value>)> {
    let email_id = post_json(app_router, "/api/v1/send", &native_send_sample()).await["id"].clone();
    let deleted_email_id =
        post_json(app_router, "/api/v1/send", &native_send_sample()).await["id"].clone();
    let by_email = json!({ "email_id": email_id });
    let by_attachment = json!({ "email_id": email_id, "attachment_index": 0 });
    let raw_message = "From: app@shop.test\r\nTo: sam@example.test\r\nSubject: Raw\r\n\r\nHello";
    vec![
        (
            "getEmails",
            vec![
                json!({}),
                json!({ "query": "from:shop is:unread code", "limit": 5 }),
            ],
        ),
        ("getEmailsLatest", vec![json!({ "to": "sam@example.test" })]),
        ("getEmailsByEmailId", vec![by_email.clone()]),
        (
            "patchEmailsByEmailId",
            vec![json!({ "email_id": email_id, "is_read": true, "tags": ["qa"] })],
        ),
        ("getEmailsByEmailIdTimeline", vec![by_email.clone()]),
        ("getEmailsByEmailIdListUnsubscribe", vec![by_email.clone()]),
        ("getEmailsByEmailIdMime", vec![by_email.clone()]),
        ("getEmailsByEmailIdRaw", vec![by_email]),
        (
            "getEmailsByEmailIdAttachmentsByAttachmentIndex",
            vec![by_attachment.clone()],
        ),
        (
            "getEmailsByEmailIdPartsByAttachmentIndexThumbnail",
            vec![by_attachment],
        ),
        ("postSend", vec![native_send_sample()]),
        ("postSendRaw", vec![json!({ "raw_message": raw_message })]),
        ("getOtp", vec![json!({ "to": "sam@example.test" })]),
        ("getLinks", vec![json!({ "to": "sam@example.test" })]),
        (
            "getWaitEmail",
            vec![json!({ "to": "sam@example.test", "timeout": "1s" })],
        ),
        (
            "deleteEmailsByEmailId",
            vec![json!({ "email_id": deleted_email_id })],
        ),
        ("deleteEmails", vec![json!({})]),
    ]
}

/// Percent-encodes a query value, keeping only the characters URLs allow as they are.
fn encode_query_value(query_value: &str) -> String {
    query_value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

fn read_frozen_contract() -> Value {
    let contract_yaml = std::fs::read_to_string(FROZEN_CONTRACT_PATH)
        .unwrap_or_else(|error| panic!("the frozen contract exists: {error}"));
    serde_yaml_ng::from_str(&contract_yaml)
        .unwrap_or_else(|error| panic!("the frozen contract is valid YAML: {error}"))
}

/// Stores samples the way the SMTP listener would, without a socket.
struct StoringSampleSender {
    operation_context: OperationContext,
}

impl SampleEmailSender for StoringSampleSender {
    fn send_sample_email<'sender>(
        &'sender self,
        sample_email: SampleEmail,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + 'sender>> {
        Box::pin(async move {
            let smtp_message = SmtpMessage {
                raw_message: sample_email.raw_message,
                mail_from: sample_email.mail_from,
                recipients: vec![sample_email.recipient],
                smtp_session_id: "01JSAMPLESESSION0000000000".to_owned(),
                auth_user: None,
            };
            store_smtp_message(&self.operation_context, smtp_message)
                .await
                .map_err(|store_error| store_error.to_string())
        })
    }
}

fn build_operation_context() -> OperationContext {
    let operation_context = build_bare_operation_context();
    operation_context
        .clone()
        .with_sample_email_sender(Arc::new(StoringSampleSender { operation_context }))
}

fn build_bare_operation_context() -> OperationContext {
    OperationContext::new(
        Arc::new(
            Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)
                .unwrap_or_else(|error| panic!("an in-memory database: {error}")),
        ),
        Arc::new(FixedClock::new(1_767_225_600_000)),
        Arc::new(sendmock_core::SystemIdGenerator),
        InstanceDetails {
            version: "0.0.0",
            channel: ReleaseChannel::Dev,
            started_at_unix_ms: 1_767_225_600_000,
            http_address: "127.0.0.1:8025".to_owned(),
            smtp_address: "127.0.0.1:1025".to_owned(),
            provider_address: None,
            is_container: false,
        },
    )
}

/// Follows `$ref`s into `components.schemas` until it reaches a schema with a body.
fn resolve_schema<'document>(
    document: &'document Value,
    schema: &'document Value,
) -> &'document Value {
    match schema["$ref"]
        .as_str()
        .and_then(|reference| reference.strip_prefix("#/"))
    {
        Some(pointer) => resolve_schema(
            document,
            document
                .pointer(&format!("/{pointer}"))
                .unwrap_or(&Value::Null),
        ),
        None => schema,
    }
}

fn top_level_shape(document: &Value, schema: &Value) -> (BTreeSet<String>, BTreeSet<String>) {
    let resolved_schema = resolve_schema(document, schema);
    let property_names = resolved_schema["properties"]
        .as_object()
        .into_iter()
        .flat_map(|properties| properties.keys().cloned())
        .collect();
    let required_names = resolved_schema["required"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|name| name.as_str().map(str::to_owned))
        .collect();
    (property_names, required_names)
}

fn response_schema<'operation>(
    operation_object: &'operation Value,
    success_code: &str,
) -> &'operation Value {
    &operation_object["responses"][success_code]["content"]["application/json"]["schema"]
}

fn request_schema(operation_object: &Value) -> &Value {
    &operation_object["requestBody"]["content"]["application/json"]["schema"]
}

/// What the tests need to know about one operation the binary serves.
struct ServedOperation {
    path: String,
    method: String,
    operation_id: String,
    success_code: String,
    is_json_answer: bool,
    raw_body_input: Option<String>,
    path_inputs: Vec<(String, String)>,
    is_destructive: bool,
}

fn served_operations(operation_registry: &OperationRegistry) -> Vec<ServedOperation> {
    operation_registry
        .operations()
        .iter()
        .map(|operation| {
            let definition = operation.definition();
            ServedOperation {
                path: definition.path.to_owned(),
                method: definition.method.as_str().to_lowercase(),
                operation_id: definition.operation_id.to_owned(),
                success_code: definition.success_status.code().to_string(),
                is_json_answer: definition.answer_kind == AnswerKind::Json
                    && definition.success_status != SuccessStatus::NoContent,
                raw_body_input: definition
                    .raw_body_input
                    .map(|raw_body| raw_body.input_name.to_owned()),
                path_inputs: definition.path_parameter_names(),
                is_destructive: definition.is_destructive,
            }
        })
        .collect()
}

/// Destructive operations last, deleting one before deleting all, so samples that read an
/// item still find it.
fn in_safe_order(mut served: Vec<ServedOperation>) -> Vec<ServedOperation> {
    served.sort_by_key(|served_operation| {
        (
            served_operation.is_destructive,
            served_operation.path.len() < 20,
        )
    });
    served
}

// AC: PL-01.1
#[test]
fn every_served_operation_is_in_the_frozen_contract_with_the_same_id_and_summary() {
    let frozen_contract = read_frozen_contract();
    let generated_document = build_openapi_document(&build_operation_registry(), "0.0.0");

    for served_operation in served_operations(&build_operation_registry()) {
        let ServedOperation {
            path,
            method,
            operation_id,
            ..
        } = &served_operation;
        let frozen_operation = &frozen_contract["paths"][path][method];
        let generated_operation = &generated_document["paths"][path][method];

        assert!(
            frozen_operation.is_object(),
            "{method} {path} is not in docs/api/openapi.yaml"
        );
        assert_eq!(
            frozen_operation["operationId"],
            operation_id.as_str(),
            "{method} {path}"
        );
        assert_eq!(
            frozen_operation["summary"], generated_operation["summary"],
            "{method} {path}"
        );
    }
}

// AC: PL-01.1
#[test]
fn bodies_have_the_contract_properties_and_required_fields() {
    let frozen_contract = read_frozen_contract();
    let generated_document = build_openapi_document(&build_operation_registry(), "0.0.0");

    for served_operation in served_operations(&build_operation_registry()) {
        let ServedOperation {
            path,
            method,
            success_code,
            ..
        } = &served_operation;
        let frozen_operation = &frozen_contract["paths"][path][method];
        let generated_operation = &generated_document["paths"][path][method];

        assert_eq!(
            top_level_shape(
                &generated_document,
                response_schema(generated_operation, success_code)
            ),
            top_level_shape(
                &frozen_contract,
                response_schema(frozen_operation, success_code)
            ),
            "the answer of {method} {path}"
        );
        assert_eq!(
            top_level_shape(&generated_document, request_schema(generated_operation)),
            top_level_shape(&frozen_contract, request_schema(frozen_operation)),
            "the request body of {method} {path}"
        );
    }
}

fn validate_against_frozen_schema(
    frozen_contract: &Value,
    schema: &Value,
    instance: &Value,
) -> Vec<String> {
    let mut validation_root = schema.clone();
    validation_root["components"] = frozen_contract["components"].clone();
    let validator = jsonschema::draft202012::new(&validation_root)
        .unwrap_or_else(|error| panic!("the frozen schema compiles: {error}"));
    validator
        .iter_errors(instance)
        .map(|error| error.to_string())
        .collect()
}

/// The request an operation's input makes: path values in the URL, the rest in the query
/// string, the JSON body or the raw body.
fn build_operation_request(served_operation: &ServedOperation, input: &Value) -> Request<Body> {
    let mut remaining_input = input.as_object().cloned().unwrap_or_default();
    let mut request_path = served_operation.path.clone();
    for (placeholder, input_name) in &served_operation.path_inputs {
        let path_value = remaining_input.remove(input_name).unwrap_or_default();
        let path_text = path_value
            .as_str()
            .map_or_else(|| path_value.to_string(), str::to_owned);
        request_path = request_path.replace(&format!("{{{placeholder}}}"), &path_text);
    }
    let has_body = served_operation.method != "get" && served_operation.method != "delete";
    if !has_body && !remaining_input.is_empty() {
        let query_string: Vec<String> = remaining_input
            .iter()
            .map(|(name, value)| {
                format!(
                    "{name}={}",
                    encode_query_value(
                        &value
                            .as_str()
                            .map_or_else(|| value.to_string(), str::to_owned)
                    )
                )
            })
            .collect();
        request_path = format!("{request_path}?{}", query_string.join("&"));
    }
    let body = match (&served_operation.raw_body_input, has_body) {
        (Some(raw_input_name), _) => Body::from(
            remaining_input[raw_input_name]
                .as_str()
                .unwrap_or_default()
                .to_owned(),
        ),
        (None, true) => Body::from(Value::Object(remaining_input).to_string()),
        (None, false) => Body::empty(),
    };
    Request::builder()
        .method(served_operation.method.to_uppercase().as_str())
        .uri(request_path)
        .header("content-type", "application/json")
        .body(body)
        .unwrap_or_else(|error| panic!("a valid request: {error}"))
}

/// Sends the request and checks the status; the JSON answer, when the operation has one.
async fn send_operation_request(
    app_router: &axum::Router,
    served_operation: &ServedOperation,
    input: &Value,
) -> Option<Value> {
    let response = app_router
        .clone()
        .oneshot(build_operation_request(served_operation, input))
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    assert_eq!(
        response.status().as_u16().to_string(),
        served_operation.success_code,
        "{} answered {}",
        served_operation.operation_id,
        response.status()
    );
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    served_operation.is_json_answer.then(|| {
        serde_json::from_slice(&body_bytes).unwrap_or_else(|error| panic!("a JSON answer: {error}"))
    })
}

fn without_path_inputs(served_operation: &ServedOperation, input: &Value) -> Value {
    let mut body_input = input.as_object().cloned().unwrap_or_default();
    for (_, input_name) in &served_operation.path_inputs {
        body_input.remove(input_name);
    }
    Value::Object(body_input)
}

// AC: PL-01.1
#[tokio::test]
async fn real_answers_and_sample_requests_match_the_frozen_schemas() {
    let frozen_contract = read_frozen_contract();
    let operation_registry = build_operation_registry();
    let operation_context = build_operation_context();
    let app_router = build_app_router(
        &operation_registry,
        &operation_context,
        Arc::new(NoUiAssets),
    );
    let prepared_samples = prepare_sample_inputs(&app_router, &operation_context).await;

    for served_operation in in_safe_order(served_operations(&operation_registry)) {
        let ServedOperation {
            path,
            method,
            operation_id,
            success_code,
            ..
        } = &served_operation;
        let frozen_operation = &frozen_contract["paths"][path][method];
        let inputs = prepared_samples
            .get(operation_id.as_str())
            .unwrap_or_else(|| panic!("add sample inputs for {operation_id}"));
        for input in inputs {
            let has_json_body =
                method != "get" && method != "delete" && served_operation.raw_body_input.is_none();
            if has_json_body {
                let request_errors = validate_against_frozen_schema(
                    &frozen_contract,
                    request_schema(frozen_operation),
                    &without_path_inputs(&served_operation, input),
                );
                assert!(
                    request_errors.is_empty(),
                    "the sample request of {operation_id}: {request_errors:?}"
                );
            }

            let answer = send_operation_request(&app_router, &served_operation, input).await;

            if let Some(answer) = answer {
                let answer_errors = validate_against_frozen_schema(
                    &frozen_contract,
                    response_schema(frozen_operation, success_code),
                    &answer,
                );
                assert!(
                    answer_errors.is_empty(),
                    "the answer of {operation_id}: {answer_errors:?}"
                );
            }
        }
    }
}

fn collect_references(value: &Value, references: &mut Vec<String>) {
    match value {
        Value::Object(object) => {
            if let Some(Value::String(reference)) = object.get("$ref") {
                references.push(reference.clone());
            }
            object
                .values()
                .for_each(|nested_value| collect_references(nested_value, references));
        }
        Value::Array(items) => items
            .iter()
            .for_each(|item| collect_references(item, references)),
        _ => {}
    }
}

// AC: PL-01.3
#[tokio::test]
async fn serves_a_valid_openapi_document() {
    let app_router = build_app_router(
        &build_operation_registry(),
        &build_operation_context(),
        Arc::new(NoUiAssets),
    );

    let response = app_router
        .oneshot(
            Request::builder()
                .uri("/api/openapi.json")
                .body(Body::empty())
                .unwrap_or_else(|error| panic!("a valid request: {error}")),
        )
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));

    assert!(response.status().is_success());
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    let openapi_document: Value = serde_json::from_slice(&body_bytes)
        .unwrap_or_else(|error| panic!("a JSON document: {error}"));
    assert_eq!(openapi_document["openapi"], "3.1.0");
    let mut references = Vec::new();
    collect_references(&openapi_document, &mut references);
    for reference in references {
        let pointer = reference.strip_prefix('#').unwrap_or_default();
        assert!(
            openapi_document.pointer(pointer).is_some(),
            "{reference} does not resolve"
        );
    }
    for (schema_name, schema) in openapi_document["components"]["schemas"]
        .as_object()
        .into_iter()
        .flatten()
    {
        assert!(
            jsonschema::meta::is_valid(schema),
            "{schema_name} is not a valid JSON Schema"
        );
    }
}
