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
    builtin_email_providers, builtin_sms_providers, enqueue_webhook_delivery, run_due_deliveries,
    store_smtp_message,
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
        ("getStats", vec![json!({})]),
        ("getSeedStatus", vec![json!({})]),
        ("getSeedExport", vec![json!({})]),
        (
            "postSeedApply",
            vec![json!({ "seed_toml": "[settings]\nsms_failure_rate_percent = 0\n" })],
        ),
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
    samples.extend(prepare_email_outcome_samples(app_router).await);
    samples.extend(prepare_open_samples(app_router).await);
    samples.extend(prepare_log_samples(operation_context).await);
    samples.extend(prepare_update_samples(operation_context).await);
    samples.extend(prepare_sms_samples(app_router).await);
    samples.extend(prepare_sms_reply_samples(app_router).await);
    samples.extend(prepare_payment_flow_samples(app_router).await);
    samples.extend(prepare_payment_method_samples(app_router).await);
    samples.extend(prepare_payment_gateway_samples(app_router).await);
    samples.extend(prepare_payment_samples(app_router).await);
    samples.extend(prepare_outcome_rule_samples(app_router).await);
    samples.extend(prepare_email_outcome_rule_samples(app_router).await);
    samples.extend(prepare_number_samples(app_router).await);
    samples.extend(prepare_verify_samples(app_router).await);
    samples.extend(prepare_sms_provider_samples(app_router).await);
    samples.extend([sms_provider_create_samples()]);
    samples.extend(prepare_email_provider_samples(app_router).await);
    samples.extend(prepare_webhook_endpoint_samples(app_router).await);
    samples.extend(prepare_webhook_delivery_samples(app_router, operation_context).await);
    samples.extend(prepare_webhook_send_samples(app_router).await);
    samples.extend(prepare_saved_delivery_samples(app_router).await);
    samples.extend(prepare_webhook_rule_samples(app_router).await);
    samples.extend(prepare_webhook_variable_samples(app_router).await);
    samples.extend([webhook_preview_samples()]);
    samples.extend(prepare_webhook_template_samples(app_router).await);
    samples.extend(webhook_template_file_samples());
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

fn sms_provider_create_samples() -> (&'static str, Vec<Value>) {
    (
        "postSmsProviders",
        vec![
            json!({ "name": "SSL Wireless", "key": "ssl_wireless", "start_from": null }),
            json!({ "name": "Twilio EU", "key": "twilio_eu", "start_from": "twilio" }),
        ],
    )
}

/// A shipped email provider's settings, as `PATCH` and the preview take them.
fn email_provider_input(provider_key: &str) -> Value {
    builtin_email_providers()
        .into_iter()
        .find(|provider| provider.key == provider_key)
        .map(|provider| serde_json::to_value(MessageProviderInput::from(provider)))
        .and_then(Result::ok)
        .unwrap_or_else(|| panic!("{provider_key} is shipped"))
}

/// Brevo removed first, so restoring it applies; SparkPost-like custom ones are created.
async fn prepare_email_provider_samples(
    app_router: &axum::Router,
) -> Vec<(&'static str, Vec<Value>)> {
    let removal = Request::delete("/api/v1/emails/providers/brevo")
        .body(Body::empty())
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    app_router
        .clone()
        .oneshot(removal)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let mut postmark_update = email_provider_input("postmark");
    postmark_update["provider_key"] = json!("postmark");
    vec![
        ("getEmailsProviders", vec![json!({})]),
        (
            "getEmailsProvidersByProviderKey",
            vec![json!({ "provider_key": "sendgrid" })],
        ),
        ("patchEmailsProvidersByProviderKey", vec![postmark_update]),
        (
            "postEmailsProvidersByProviderKeyRestore",
            vec![json!({ "provider_key": "brevo" })],
        ),
        (
            "postEmailsProvidersByProviderKeyReset",
            vec![json!({ "provider_key": "sendgrid" })],
        ),
        (
            "postEmailsProvidersByProviderKeyPreview",
            vec![json!({ "provider_key": "resend", "provider": email_provider_input("resend") })],
        ),
        (
            "getEmailsProvidersByProviderKeyCredentialsByCredentialName",
            vec![json!({ "provider_key": "sendgrid", "credential_name": "api_key" })],
        ),
        (
            "deleteEmailsProvidersByProviderKey",
            vec![json!({ "provider_key": "ses" })],
        ),
        (
            "postEmailsProviders",
            vec![json!({ "name": "SparkPost", "key": "sparkpost", "start_from": "sendgrid" })],
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

/// Two endpoints: one to edit, reveal, rotate and save as a template, one to delete.
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
            "postWebhooksEndpointsByEndpointIdSaveAsTemplate",
            vec![json!({ "endpoint_id": edited_endpoint_id, "name": "Orders template" })],
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
            "getWebhooksMetrics",
            vec![
                json!({ "range": "24h" }),
                json!({ "range": "7d", "endpoint_id": endpoint_id }),
            ],
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

/// A test send, manual sends (the sample, a template, variables and an edited body) and
/// replays of a sent manual delivery: as it was, rendered again, and edited.
async fn prepare_webhook_send_samples(
    app_router: &axum::Router,
) -> Vec<(&'static str, Vec<Value>)> {
    let endpoint = post_json(
        app_router,
        "/api/v1/webhooks/endpoints",
        &webhook_endpoint_sample("Manual sends"),
    )
    .await;
    let endpoint_id = endpoint["id"].as_str().unwrap_or_default();
    let manual_delivery = post_json(
        app_router,
        &format!("/api/v1/webhooks/endpoints/{endpoint_id}/send"),
        &json!({}),
    )
    .await;
    let delivery_id = &manual_delivery["id"];
    vec![
        (
            "postWebhooksEndpointsByEndpointIdTest",
            vec![json!({ "endpoint_id": endpoint_id })],
        ),
        (
            "postWebhooksEndpointsByEndpointIdSend",
            vec![
                json!({ "endpoint_id": endpoint_id }),
                json!({
                    "endpoint_id": endpoint_id, "template_id": "slack.incoming_webhook",
                    "variables": { "reason": "manual" }, "body": "{\"text\":\"edited\"}",
                }),
            ],
        ),
        (
            "postWebhooksDeliveriesByDeliveryIdReplay",
            vec![
                json!({ "delivery_id": delivery_id, "rerender": false }),
                json!({ "delivery_id": delivery_id, "rerender": true }),
                json!({
                    "delivery_id": delivery_id, "rerender": false, "body": "{}",
                    "headers": { "X-Replay": "1" },
                }),
            ],
        ),
    ]
}

/// A saved manual send: listed, saved again, renamed, sent as it was and rendered again,
/// turned into a template and deleted.
async fn prepare_saved_delivery_samples(
    app_router: &axum::Router,
) -> Vec<(&'static str, Vec<Value>)> {
    let endpoint = post_json(
        app_router,
        "/api/v1/webhooks/endpoints",
        &webhook_endpoint_sample("Saved sends"),
    )
    .await;
    let endpoint_id = endpoint["id"].as_str().unwrap_or_default();
    let manual_delivery = post_json(
        app_router,
        &format!("/api/v1/webhooks/endpoints/{endpoint_id}/send"),
        &json!({}),
    )
    .await;
    let delivery_id = &manual_delivery["id"];
    let saved_delivery = post_json(
        app_router,
        "/api/v1/webhooks/saved",
        &json!({ "name": "Order webhook", "delivery_id": delivery_id }),
    )
    .await;
    let saved_id = &saved_delivery["id"];
    vec![
        ("getWebhooksSaved", vec![json!({})]),
        (
            "postWebhooksSaved",
            vec![json!({ "name": "Failed order webhook", "delivery_id": delivery_id })],
        ),
        (
            "patchWebhooksSavedBySavedId",
            vec![json!({ "saved_id": saved_id, "name": "Order webhook, missing SKU" })],
        ),
        (
            "postWebhooksSavedBySavedIdSend",
            vec![
                json!({ "saved_id": saved_id, "endpoint_id": endpoint_id, "rerender": false }),
                json!({ "saved_id": saved_id, "endpoint_id": endpoint_id, "rerender": true }),
            ],
        ),
        (
            "postWebhooksSavedBySavedIdTemplate",
            vec![json!({ "saved_id": saved_id, "name": "Order webhook" })],
        ),
        (
            "deleteWebhooksSavedBySavedId",
            vec![json!({ "saved_id": saved_id })],
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

/// Export a built-in, import a new file, and the reference for two kinds of event.
fn webhook_template_file_samples() -> Vec<(&'static str, Vec<Value>)> {
    let imported_file = "name = \"Imported\"\n[request]\nmethod = \"POST\"\ncontent_type = \"application/json\"\nbody = '{\"subject\": \"{{ data.subject }}\"}'\n";
    vec![
        (
            "getWebhooksTemplatesByTemplateIdExport",
            vec![json!({ "template_id": "slack.incoming_webhook" })],
        ),
        (
            "postWebhooksTemplatesImport",
            vec![json!({ "file_text": imported_file })],
        ),
        (
            "getWebhooksTemplateReference",
            vec![json!({}), json!({ "events": "email.received,sms.inbound" })],
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

fn email_outcome_rule_sample(pattern: &str) -> Value {
    json!({
        "pattern": pattern, "outcome": "hard_bounce", "smtp_code": "550 5.1.1",
        "diagnostic": "user unknown", "note": "Bounce every QA signup", "is_enabled": true,
    })
}

/// Two custom outcome addresses: one to edit and move, one to delete.
async fn prepare_email_outcome_rule_samples(
    app_router: &axum::Router,
) -> Vec<(&'static str, Vec<Value>)> {
    let path = "/api/v1/outcome-rules/email";
    let edited_rule_id = post_json(
        app_router,
        path,
        &email_outcome_rule_sample("*@bounce.qa.test"),
    )
    .await["id"]
        .clone();
    let deleted_rule_id = post_json(
        app_router,
        path,
        &email_outcome_rule_sample("qa+*@shop.test"),
    )
    .await["id"]
        .clone();
    vec![
        ("getOutcomeRulesEmail", vec![json!({})]),
        (
            "postOutcomeRulesEmail",
            vec![
                email_outcome_rule_sample("vip@shop.test"),
                json!({
                    "pattern": "*@blocked.test", "outcome": "reject", "smtp_code": null,
                    "diagnostic": null, "note": "", "is_enabled": false,
                }),
            ],
        ),
        (
            "patchOutcomeRulesEmailByRuleId",
            vec![json!({ "rule_id": edited_rule_id, "is_enabled": false, "smtp_code": null })],
        ),
        (
            "postOutcomeRulesEmailByRuleIdMove",
            vec![json!({ "rule_id": edited_rule_id, "direction": "down" })],
        ),
        (
            "deleteOutcomeRulesEmailByRuleId",
            vec![json!({ "rule_id": deleted_rule_id })],
        ),
        (
            "postOutcomeRulesEmailTest",
            vec![
                json!({ "address": "sam@bounce.qa.test" }),
                json!({ "address": "bounce@shop.test" }),
                json!({ "address": "sam@shop.test" }),
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

/// An inbound message to the number whose reply webhook the number samples set up before the
/// samples run; this build has no HTTP sender, so the resend records a connection failure.
async fn prepare_sms_reply_samples(app_router: &axum::Router) -> Vec<(&'static str, Vec<Value>)> {
    let inbound_sms_id = post_json(
        app_router,
        "/api/v1/sms/inbound",
        &json!({ "from": "+8801700000000", "to": "+15550001111", "body": "YES" }),
    )
    .await["id"]
        .clone();
    vec![(
        "postSmsBySmsIdReplyWebhookResend",
        vec![json!({ "sms_id": inbound_sms_id })],
    )]
}

fn payment_flow_sample(flow_key: &str) -> Value {
    json!({
        "key": flow_key, "name": "QR wallet", "picker_tab": "Mobile banking",
        "steps": [
            { "type": "qr_code", "title": "Scan to pay", "field_label": "", "hint": "Open {method}.", "button_label": "I have paid" },
            { "type": "pin", "title": "", "field_label": "PIN", "hint": "", "button_label": "Pay {amount}" },
        ],
    })
}

/// Two custom flows: one to edit step by step, one to delete.
async fn prepare_payment_flow_samples(
    app_router: &axum::Router,
) -> Vec<(&'static str, Vec<Value>)> {
    for flow_key in ["qr_wallet", "deleted_flow"] {
        post_json(
            app_router,
            "/api/v1/payments/flows",
            &payment_flow_sample(flow_key),
        )
        .await;
    }
    let mut renamed_flow = payment_flow_sample("qr_wallet");
    renamed_flow["flow_key"] = json!("qr_wallet");
    vec![
        ("getPaymentsStepTypes", vec![json!({})]),
        ("getPaymentsFlowVariables", vec![json!({})]),
        ("getPaymentsFlows", vec![json!({})]),
        ("postPaymentsFlows", vec![payment_flow_sample("voucher_qr")]),
        (
            "getPaymentsFlowsByFlowKey",
            vec![json!({ "flow_key": "wallet" })],
        ),
        ("patchPaymentsFlowsByFlowKey", vec![renamed_flow]),
        (
            "postPaymentsFlowsByFlowKeyReset",
            vec![json!({ "flow_key": "wallet" })],
        ),
        (
            "postPaymentsFlowsByFlowKeySteps",
            vec![
                json!({ "flow_key": "qr_wallet", "step": { "type": "otp", "title": "", "field_label": "Code", "hint": "", "button_label": "Confirm" } }),
            ],
        ),
        (
            "patchPaymentsFlowsByFlowKeyStepsByStepIndex",
            vec![json!({ "flow_key": "qr_wallet", "step_index": 0, "button_label": "Paid" })],
        ),
        (
            "deletePaymentsFlowsByFlowKeyStepsByStepIndex",
            vec![json!({ "flow_key": "qr_wallet", "step_index": 1 })],
        ),
        (
            "deletePaymentsFlowsByFlowKey",
            vec![json!({ "flow_key": "deleted_flow" })],
        ),
    ]
}

fn payment_method_sample(method_key: &str) -> Value {
    json!({
        "key": method_key, "name": "Upay", "flow": "wallet", "accent": "#0a7cff", "is_enabled": true,
        "test_cards": [],
        "test_numbers": [{ "number": "01770000001", "outcome": "succeed", "decline_reason": null }],
        "otp": "123456", "pin": "12121", "default_outcome": "succeed", "test_account": "",
    })
}

/// A custom method to edit and one to delete; the built-in bKash to reset.
async fn prepare_payment_method_samples(
    app_router: &axum::Router,
) -> Vec<(&'static str, Vec<Value>)> {
    for method_key in ["upay", "deleted_method"] {
        post_json(
            app_router,
            "/api/v1/payments/methods",
            &payment_method_sample(method_key),
        )
        .await;
    }
    let mut renamed_method = payment_method_sample("upay");
    renamed_method["method_key"] = json!("upay");
    vec![
        ("getPaymentsMethods", vec![json!({})]),
        ("postPaymentsMethods", vec![payment_method_sample("tap")]),
        (
            "getPaymentsMethodsByMethodKey",
            vec![json!({ "method_key": "card" })],
        ),
        ("patchPaymentsMethodsByMethodKey", vec![renamed_method]),
        (
            "postPaymentsMethodsByMethodKeyReset",
            vec![json!({ "method_key": "bkash" })],
        ),
        (
            "deletePaymentsMethodsByMethodKey",
            vec![json!({ "method_key": "deleted_method" })],
        ),
    ]
}

/// A gateway's answer as the body of a change to it.
async fn read_gateway_change(app_router: &axum::Router, gateway_key: &str) -> Value {
    let gateway_path = format!("/api/v1/payments/gateways/{gateway_key}");
    let mut gateway_change = send_json(app_router, "GET", &gateway_path, &json!({})).await;
    if let Some(fields) = gateway_change.as_object_mut() {
        for read_only_field in ["is_builtin", "is_modified", "payment_count"] {
            fields.remove(read_only_field);
        }
    }
    gateway_change["gateway_key"] = json!(gateway_key);
    gateway_change
}

/// The name of the gateway's first secret credential.
async fn find_secret_credential_name(app_router: &axum::Router, gateway_key: &str) -> Value {
    let gateway_path = format!("/api/v1/payments/gateways/{gateway_key}");
    let payment_gateway = send_json(app_router, "GET", &gateway_path, &json!({})).await;
    payment_gateway["credentials"]
        .as_array()
        .and_then(|credentials| {
            credentials
                .iter()
                .find(|credential| credential["is_secret"] == true)
        })
        .map(|credential| credential["name"].clone())
        .unwrap_or(Value::Null)
}

/// Two custom gateways (one to edit, one to delete); the built-in Stripe to reset and reveal.
async fn prepare_payment_gateway_samples(
    app_router: &axum::Router,
) -> Vec<(&'static str, Vec<Value>)> {
    for gateway_key in ["nagad", "deleted_gateway"] {
        post_json(
            app_router,
            "/api/v1/payments/gateways",
            &json!({ "name": "Nagad", "key": gateway_key, "start_from": "sslcommerz" }),
        )
        .await;
    }
    let nagad = read_gateway_change(app_router, "nagad").await;
    let secret_name = find_secret_credential_name(app_router, "stripe").await;
    vec![
        ("getPaymentsGateways", vec![json!({})]),
        (
            "postPaymentsGateways",
            vec![json!({ "name": "Upay", "key": "upay", "start_from": null })],
        ),
        (
            "getPaymentsGatewaysByGatewayKey",
            vec![json!({ "gateway_key": "stripe" })],
        ),
        ("patchPaymentsGatewaysByGatewayKey", vec![nagad]),
        (
            "postPaymentsGatewaysByGatewayKeyReset",
            vec![json!({ "gateway_key": "stripe" })],
        ),
        (
            "getPaymentsGatewaysByGatewayKeyCredentialsByCredentialName",
            vec![json!({ "gateway_key": "stripe", "credential_name": secret_name })],
        ),
        (
            "deletePaymentsGatewaysByGatewayKey",
            vec![json!({ "gateway_key": "deleted_gateway" })],
        ),
    ]
}

/// A checkout waiting on its page, read back as a payment and as its session.
async fn prepare_payment_samples(app_router: &axum::Router) -> Vec<(&'static str, Vec<Value>)> {
    let checkout = json!({
        "provider": "sslcommerz", "amount_minor": 120_000, "currency": "BDT",
        "customer_email": "ruma@example.com",
        "line_items": [{ "name": "Tea", "quantity": 2, "unit_amount_minor": 60_000 }],
    });
    let payment_id =
        post_json(app_router, "/api/v1/payments/checkout", &checkout).await["id"].clone();
    let mut samples = prepare_checkout_action_samples(app_router, &payment_id).await;
    samples.extend(vec![
        (
            "getPayments",
            vec![
                json!({}),
                json!({ "status": "requires_payment,succeeded", "provider": "sslcommerz", "currency": "BDT", "limit": 5 }),
            ],
        ),
        ("getPaymentsTestCards", vec![json!({})]),
        (
            "getWaitPayment",
            vec![
                json!({ "provider": "sslcommerz", "status": "requires_payment", "timeout": "1s" }),
            ],
        ),
        (
            "postPaymentsCheckout",
            vec![
                checkout,
                json!({ "provider": "stripe", "amount_minor": 500 }),
            ],
        ),
        (
            "getPaymentsByPaymentId",
            vec![json!({ "payment_id": payment_id })],
        ),
        (
            "getCheckoutSessionsBySessionId",
            vec![json!({ "session_id": payment_id })],
        ),
    ]);
    samples
}

/// A completed card checkout and a gateway preview, on a fresh Stripe payment and `payment_id`.
/// A native checkout whose gateway notifies an endpoint, so it has a notification to resend.
async fn prepare_notified_payment(app_router: &axum::Router) -> Value {
    let endpoint_id = post_json(
        app_router,
        "/api/v1/webhooks/endpoints",
        &webhook_endpoint_sample("Shop payments"),
    )
    .await["id"]
        .clone();
    let gateway_path = "/api/v1/payments/gateways/native";
    let mut native_gateway = send_json(app_router, "GET", gateway_path, &Value::Null).await;
    native_gateway["notification_endpoint_id"] = endpoint_id;
    send_json(app_router, "PATCH", gateway_path, &native_gateway).await;
    post_json(
        app_router,
        "/api/v1/payments/checkout",
        &json!({ "provider": "native", "amount_minor": 900 }),
    )
    .await["id"]
        .clone()
}

async fn prepare_checkout_action_samples(
    app_router: &axum::Router,
    payment_id: &Value,
) -> Vec<(&'static str, Vec<Value>)> {
    let notified_payment_id = prepare_notified_payment(app_router).await;
    let card_payment_id = post_json(
        app_router,
        "/api/v1/payments/checkout",
        &json!({ "provider": "stripe", "amount_minor": 500 }),
    )
    .await["id"]
        .clone();
    let stripe_gateway = send_json(
        app_router,
        "GET",
        "/api/v1/payments/gateways/stripe",
        &Value::Null,
    )
    .await;
    vec![
        (
            "postPaymentsGatewaysByGatewayKeyPreview",
            vec![
                json!({ "gateway_key": "stripe", "gateway": stripe_gateway, "event_type": "payment.succeeded", "redirect_outcome": "success" }),
                json!({ "gateway_key": "stripe", "gateway": stripe_gateway, "payment_id": payment_id, "event_type": "payment.created", "redirect_outcome": "cancel" }),
            ],
        ),
        (
            "postPaymentsByPaymentIdSimulate",
            vec![
                json!({ "payment_id": notified_payment_id, "action": "succeed" }),
                json!({ "payment_id": notified_payment_id, "action": "refund", "refund_amount_minor": 100 }),
            ],
        ),
        (
            "postPaymentsByPaymentIdNotify",
            vec![json!({ "payment_id": notified_payment_id })],
        ),
        (
            "postCheckoutSessionsBySessionIdComplete",
            vec![
                json!({ "session_id": card_payment_id, "action": "pay", "method_key": "card", "card": { "number": "4242424242424242", "exp_month": 12, "exp_year": 2030, "cvc": "123", "holder_name": "Sam Tester" } }),
                json!({ "session_id": payment_id, "action": "require_three_ds" }),
            ],
        ),
    ]
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

/// Simulated delivery outcomes on a sent email: a soft bounce and a delivery.
async fn prepare_email_outcome_samples(
    app_router: &axum::Router,
) -> Vec<(&'static str, Vec<Value>)> {
    let email_id = post_json(app_router, "/api/v1/send", &native_send_sample()).await["id"].clone();
    vec![(
        "postEmailsByEmailIdSimulate",
        vec![
            json!({ "email_id": email_id, "event": "bounced", "bounce_type": "soft" }),
            json!({ "email_id": email_id, "event": "delivered" }),
        ],
    )]
}

/// Opens of a sent email and an outbound SMS, from the UI with a user agent and from a script.
async fn prepare_open_samples(app_router: &axum::Router) -> Vec<(&'static str, Vec<Value>)> {
    let email_id = post_json(app_router, "/api/v1/send", &native_send_sample()).await["id"].clone();
    let sms_id = post_json(
        app_router,
        "/api/v1/sms",
        &json!({ "from": "+15550001111", "to": "+8801700000000", "body": "Your code is 482913" }),
    )
    .await["id"]
        .clone();
    let browser_open = json!({ "source": "ui", "user_agent": "Mozilla/5.0 (Macintosh)" });
    let mut email_view = browser_open.clone();
    email_view["email_id"] = email_id.clone();
    let mut sms_view = browser_open;
    sms_view["sms_id"] = sms_id.clone();
    vec![
        (
            "postEmailsByEmailIdOpen",
            vec![email_view, json!({ "email_id": email_id })],
        ),
        (
            "getEmailsByEmailIdOpens",
            vec![json!({ "email_id": email_id })],
        ),
        (
            "postSmsBySmsIdOpen",
            vec![sms_view, json!({ "sms_id": sms_id, "source": "manual" })],
        ),
        ("getSmsBySmsIdOpens", vec![json!({ "sms_id": sms_id })]),
    ]
}

async fn prepare_email_samples(app_router: &axum::Router) -> Vec<(&'static str, Vec<Value>)> {
    let email_id = post_json(app_router, "/api/v1/send", &native_send_sample()).await["id"].clone();
    let deleted_email_id =
        post_json(app_router, "/api/v1/send", &native_send_sample()).await["id"].clone();
    let by_email = json!({ "email_id": email_id });
    let by_attachment = json!({ "email_id": email_id, "attachment_index": 0 });
    let raw_message = "From: app@shop.test\r\nTo: sam@example.test\r\nSubject: Raw\r\n\r\nHello";
    let mut samples = build_email_check_samples(&by_email);
    samples.extend([
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
    ]);
    samples
}

fn build_email_check_samples(by_email: &Value) -> Vec<(&'static str, Vec<Value>)> {
    vec![
        ("getEmailsByEmailIdHtmlCheck", vec![by_email.clone()]),
        ("postEmailsByEmailIdLinkCheck", vec![by_email.clone()]),
        ("postEmailsByEmailIdSpamCheck", vec![by_email.clone()]),
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
