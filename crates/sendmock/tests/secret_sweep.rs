#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod api_client;
    pub mod mcp_session;
    pub mod ok_responder;
    pub mod secret_sweep_surfaces;
    pub mod sendmock_process;
    pub mod smtp_auth_sender;
}

use std::net::TcpListener;
use std::path::Path;
use std::time::Duration;

use reqwest::Method;
use sendmock_smtp::encode_base64_text;
use serde_json::{Value, json};

use support::api_client::ApiClient;
use support::mcp_session::McpSession;
use support::ok_responder::start_ok_responder;
use support::secret_sweep_surfaces::{
    PathValues, SweptAnswer, harvest_field, sweep_mcp_answers, sweep_rest_answers,
};
use support::sendmock_process::{SendmockProcess, sendmock_command};
use support::smtp_auth_sender::{SmtpLogin, send_mail_with_auth};

const SMTP_USERNAME: &str = "mailer";
const SMTP_PASSWORD: &str = "SweepSmtpPass7Kq";
const RELAY_USERNAME: &str = "relayuser";
const STARTUP_RELAY_PASSWORD: &str = "SweepRelayBoot3Xw";
const SETTINGS_RELAY_PASSWORD: &str = "SweepRelayEdit5Zr";
const UI_USERNAME: &str = "admin";
const UI_PASSWORD: &str = "SweepUiPass2Hd";
const API_TOKEN: &str = "SweepApiToken9Mv";
const VARIABLE_SECRET: &str = "SweepVarSecret4Lp";
const RELEASE_RECIPIENT: &str = "qa@example.com";
const INTEGRATION_STACKS: [&str; 17] = [
    "laravel", "node", "python", "go", "java", "ruby", "dotnet", "curl", "php", "express",
    "nestjs", "django", "flask", "fastapi", "spring", "rails", "aspnet",
];

/// A secret the test set, with every form it could leak in (as typed, or base64 encoded on
/// the wire).
struct PlantedSecret {
    kind: String,
    searched_forms: Vec<String>,
}

impl PlantedSecret {
    fn new(kind: &str, searched_forms: Vec<String>) -> Self {
        Self {
            kind: kind.to_owned(),
            searched_forms,
        }
    }
}

fn find_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|local_addr| local_addr.port())
        .unwrap_or_else(|bind_error| panic!("a free port: {bind_error}"))
}

fn relay_url(smtp_port: u16, relay_password: &str) -> String {
    format!("smtp://{RELAY_USERNAME}:{relay_password}@127.0.0.1:{smtp_port}")
}

/// A server with SMTP AUTH from a credentials file, a relay with a password, UI auth and an
/// API token, logging at debug level so every log line is checked.
fn start_server(working_directory: &Path, smtp_port: u16) -> SendmockProcess {
    let credentials_path = working_directory.join("smtp-users.txt");
    std::fs::write(
        &credentials_path,
        format!("{SMTP_USERNAME}:{SMTP_PASSWORD}\n{RELAY_USERNAME}:{STARTUP_RELAY_PASSWORD}\n{RELAY_USERNAME}2:{SETTINGS_RELAY_PASSWORD}\n"),
    )
    .unwrap_or_else(|write_error| panic!("the credentials file: {write_error}"));
    SendmockProcess::start(sendmock_command(working_directory).args([
        "--http-addr",
        "127.0.0.1:0",
        "--smtp-addr",
        &format!("127.0.0.1:{smtp_port}"),
        "--db",
        "memory",
        "--log-format",
        "json",
        "--log-level",
        "debug",
        "--update-check",
        "off",
        "--smtp-auth",
        &format!("file:{}", credentials_path.display()),
        "--relay-smtp",
        &relay_url(smtp_port, STARTUP_RELAY_PASSWORD),
        "--relay-allowlist",
        "*@example.com",
        "--ui-auth",
        &format!("{UI_USERNAME}:{UI_PASSWORD}"),
        "--api-token",
        API_TOKEN,
    ]))
    .unwrap_or_else(|start_error| panic!("sendmock starts: {start_error}"))
}

fn access_secrets() -> Vec<PlantedSecret> {
    vec![
        PlantedSecret::new(
            "UI password",
            vec![
                UI_PASSWORD.to_owned(),
                encode_base64_text(&format!("{UI_USERNAME}:{UI_PASSWORD}")),
            ],
        ),
        PlantedSecret::new("API token", vec![API_TOKEN.to_owned()]),
    ]
}

/// Sends a JSON request and fails the test unless the server answers `expected_status`.
async fn send_expecting(
    api_client: &ApiClient,
    method: Method,
    path: &str,
    json_body: &Value,
    expected_status: u16,
) -> Value {
    let answer = api_client.send_json(method, path, Some(json_body)).await;
    assert_eq!(
        answer.status, expected_status,
        "{path}: {}",
        answer.body_text
    );
    answer.json()
}

/// A webhook endpoint secret, rotated so the previous one is kept too, and a secret variable
/// sent in a header of a delivered test.
async fn plant_webhook_secrets(
    api_client: &ApiClient,
    responder_addr: &str,
) -> (String, Vec<PlantedSecret>) {
    let variable_input = json!({
        "name": "sweep_token", "kind": "secret", "scope": "global", "endpoint_id": null,
        "value": VARIABLE_SECRET, "random_mode": null, "description": "",
    });
    send_expecting(
        api_client,
        Method::POST,
        "/api/v1/webhooks/variables",
        &variable_input,
        201,
    )
    .await;
    let endpoint = send_expecting(
        api_client,
        Method::POST,
        "/api/v1/webhooks/endpoints",
        &endpoint_input(responder_addr),
        201,
    )
    .await;
    let endpoint_id = endpoint["id"].as_str().unwrap_or_default().to_owned();
    let endpoint_path = format!("/api/v1/webhooks/endpoints/{endpoint_id}");
    let first_secret = reveal_endpoint_secret(api_client, &endpoint_path).await;
    let rotate_path = format!("{endpoint_path}/rotate-secret");
    send_expecting(
        api_client,
        Method::POST,
        &rotate_path,
        &json!({ "overlap_hours": 24 }),
        200,
    )
    .await;
    let second_secret = reveal_endpoint_secret(api_client, &endpoint_path).await;
    let test_path = format!("{endpoint_path}/test");
    let test_delivery = send_expecting(api_client, Method::POST, &test_path, &json!({}), 200).await;
    assert_eq!(test_delivery["status"], "succeeded", "{test_delivery}");
    let planted_secrets = vec![
        PlantedSecret::new("webhook variable", vec![VARIABLE_SECRET.to_owned()]),
        webhook_secret("previous webhook endpoint secret", &first_secret),
        webhook_secret("webhook endpoint secret", &second_secret),
    ];
    (endpoint_id, planted_secrets)
}

fn endpoint_input(responder_addr: &str) -> Value {
    json!({
        "name": "Sweep app",
        "url": format!("http://{responder_addr}/hooks"),
        "method": "POST",
        "headers": { "Authorization": "Bearer {{ vars.sweep_token }}" },
        "extra_fields": {},
        "template_id": "native",
        "template_mode": "linked",
        "timeout_ms": 5_000,
        "retry_policy": {
            "max_attempts": 1,
            "backoff_seconds": [1],
            "retry_on_client_errors": false,
        },
        "is_enabled": true,
        "query_params": [],
        "body_mode": "template",
        "body_fields": [],
        "fields_encoding": "json",
        "raw_content_type": "application/json",
        "raw_body": "",
        "render_mode": "strict",
    })
}

async fn reveal_endpoint_secret(api_client: &ApiClient, endpoint_path: &str) -> String {
    let revealed = api_client.get(&format!("{endpoint_path}/secret")).await;
    let secret = revealed.json()["secret"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    assert!(secret.starts_with("whsec_"), "{}", revealed.body_text);
    secret
}

/// A `whsec_` secret leaks as a whole or as its key material alone.
fn webhook_secret(kind: &str, secret: &str) -> PlantedSecret {
    let key_material = secret.trim_start_matches("whsec_").to_owned();
    PlantedSecret::new(kind, vec![secret.to_owned(), key_material])
}

/// Gives every secret credential of the provider or gateway at `item_path` a new value
/// through `PATCH`, as the UI saves it, and answers the new values by credential name.
async fn replace_secret_credentials(
    api_client: &ApiClient,
    item_path: &str,
) -> Vec<(String, String)> {
    let mut item = api_client.get(item_path).await.json();
    let mut new_values = Vec::new();
    for credential in item["credentials"].as_array_mut().into_iter().flatten() {
        if credential["is_secret"] != true {
            continue;
        }
        let credential_name = credential["name"].as_str().unwrap_or_default().to_owned();
        let item_key = item_path.rsplit('/').next().unwrap_or_default();
        let new_value = format!("Sweep{item_key}{credential_name}8Jt").replace('_', "");
        credential["value"] = json!(new_value);
        new_values.push((credential_name, new_value));
    }
    let saved = api_client
        .send_json(Method::PATCH, item_path, Some(&item))
        .await;
    assert_eq!(saved.status, 200, "{item_path}: {}", saved.body_text);
    new_values
}

fn first_secret_value(new_values: &[(String, String)]) -> String {
    new_values
        .first()
        .map(|(_, value)| value.clone())
        .unwrap_or_default()
}

fn as_planted_secrets(kind: &str, new_values: &[(String, String)]) -> Vec<PlantedSecret> {
    new_values
        .iter()
        .map(|(credential_name, value)| {
            PlantedSecret::new(&format!("{kind} {credential_name}"), vec![value.clone()])
        })
        .collect()
}

const TWILIO_ACCOUNT_SID: &str = "AC00000000000000000000000000000000";

/// The secret values each provider API call is made with.
struct ProviderCallSecrets {
    twilio_login: String,
    vonage_secret: String,
    sendgrid_key: String,
    stripe_key: String,
}

/// One call to each provider API as an app's SDK makes it, with the stored secrets.
async fn call_providers_as_sdks(api_client: &ApiClient, call_secrets: &ProviderCallSecrets) {
    let twilio_path =
        format!("/providers/twilio/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json");
    let vonage_form = format!(
        "from=Sweep&to=447700900000&text=Hi&api_key=k&api_secret={}",
        call_secrets.vonage_secret
    );
    let mail_send = json!({
        "personalizations": [{ "to": [{ "email": "dev@example.com" }] }],
        "from": { "email": "app@example.com" },
        "subject": "Sweep",
        "content": [{ "type": "text/plain", "value": "Hi" }],
    });
    let provider_answers = [
        api_client
            .post_provider_form(
                &twilio_path,
                &format!("Basic {}", encode_base64_text(&call_secrets.twilio_login)),
                "To=%2B15005550006&From=%2B15005550006&Body=Sweep",
            )
            .await,
        api_client
            .post_provider_form("/providers/vonage/sms/json", "", &vonage_form)
            .await,
        api_client
            .post_provider_json(
                "/providers/sendgrid/v3/mail/send",
                &format!("Bearer {}", call_secrets.sendgrid_key),
                &mail_send,
            )
            .await,
        api_client
            .post_provider_form(
                "/providers/stripe/v1/payment_intents",
                &format!("Bearer {}", call_secrets.stripe_key),
                "amount=1000&currency=usd&confirm=true&payment_method=pm_card_visa",
            )
            .await,
    ];
    for provider_answer in &provider_answers {
        assert!(
            (200..300).contains(&provider_answer.status),
            "{} {}",
            provider_answer.status,
            provider_answer.body_text
        );
    }
}

/// Provider credentials and a payment gateway key, each then used by a provider API call as
/// an app's SDK would make it, so they also pass through the API request log.
async fn plant_provider_secrets(api_client: &ApiClient) -> Vec<PlantedSecret> {
    let twilio = replace_secret_credentials(api_client, "/api/v1/sms/providers/twilio").await;
    let vonage = replace_secret_credentials(api_client, "/api/v1/sms/providers/vonage").await;
    let sendgrid =
        replace_secret_credentials(api_client, "/api/v1/emails/providers/sendgrid").await;
    let stripe = replace_secret_credentials(api_client, "/api/v1/payments/gateways/stripe").await;
    let call_secrets = ProviderCallSecrets {
        twilio_login: format!("{TWILIO_ACCOUNT_SID}:{}", first_secret_value(&twilio)),
        vonage_secret: first_secret_value(&vonage),
        sendgrid_key: first_secret_value(&sendgrid),
        stripe_key: first_secret_value(&stripe),
    };
    call_providers_as_sdks(api_client, &call_secrets).await;
    let mut planted_secrets = as_planted_secrets("Twilio", &twilio);
    planted_secrets.push(PlantedSecret::new(
        "Twilio login",
        vec![encode_base64_text(&call_secrets.twilio_login)],
    ));
    planted_secrets.extend(as_planted_secrets("Vonage", &vonage));
    planted_secrets.extend(as_planted_secrets("SendGrid", &sendgrid));
    planted_secrets.extend(as_planted_secrets("Stripe", &stripe));
    planted_secrets
}

/// Mail sent with SMTP AUTH (PLAIN and LOGIN), then released through a relay whose password
/// was changed in Settings; the relay is this server's own SMTP port.
async fn plant_smtp_and_relay_secrets(
    api_client: &ApiClient,
    smtp_addr: &str,
    smtp_port: u16,
) -> Vec<PlantedSecret> {
    for smtp_login in [SmtpLogin::Plain, SmtpLogin::Login] {
        send_mail_with_auth(smtp_addr, smtp_login, SMTP_USERNAME, SMTP_PASSWORD)
            .unwrap_or_else(|send_error| panic!("mail with AUTH is accepted: {send_error}"));
    }
    let relay_username = format!("{RELAY_USERNAME}2");
    let settings_relay_url =
        relay_url(smtp_port, SETTINGS_RELAY_PASSWORD).replacen(RELAY_USERNAME, &relay_username, 1);
    let settings = api_client
        .send_json(
            Method::PATCH,
            "/api/v1/settings",
            Some(&json!({ "relay_smtp_url": settings_relay_url })),
        )
        .await;
    assert_eq!(settings.status, 200, "{}", settings.body_text);
    let email_ids = harvest_field(api_client, "/api/v1/emails", "id").await;
    let release = api_client
        .send_json(
            Method::POST,
            &format!(
                "/api/v1/emails/{}/release",
                email_ids.first().cloned().unwrap_or_default()
            ),
            Some(&json!({ "to": [RELEASE_RECIPIENT] })),
        )
        .await;
    assert_eq!(release.status, 204, "{}", release.body_text);
    vec![
        smtp_secret("SMTP AUTH password", SMTP_USERNAME, SMTP_PASSWORD),
        smtp_secret(
            "startup relay password",
            RELAY_USERNAME,
            STARTUP_RELAY_PASSWORD,
        ),
        smtp_secret(
            "Settings relay password",
            &relay_username,
            SETTINGS_RELAY_PASSWORD,
        ),
    ]
}

/// An SMTP password leaks as typed or base64 encoded as AUTH PLAIN and AUTH LOGIN send it.
fn smtp_secret(kind: &str, username: &str, password: &str) -> PlantedSecret {
    PlantedSecret::new(
        kind,
        vec![
            password.to_owned(),
            encode_base64_text(password),
            encode_base64_text(&format!("\0{username}\0{password}")),
        ],
    )
}

/// The value of every path parameter the sweep can fill, from what the test created.
async fn collect_path_values(api_client: &ApiClient, endpoint_id: &str) -> PathValues {
    let mut path_values = PathValues::new();
    for (parameter_name, list_path, field_name) in [
        ("emailId", "/api/v1/emails", "id"),
        ("smsId", "/api/v1/sms", "id"),
        ("sessionId", "/api/v1/logs/smtp", "id"),
        ("requestId", "/api/v1/logs/http", "id"),
        ("deliveryId", "/api/v1/webhooks/deliveries", "id"),
        ("templateId", "/api/v1/webhooks/templates", "id"),
        ("providerKey", "/api/v1/sms/providers", "key"),
        ("providerKey", "/api/v1/emails/providers", "key"),
        ("gatewayKey", "/api/v1/payments/gateways", "key"),
        ("paymentId", "/api/v1/payments", "id"),
        ("flowKey", "/api/v1/payments/flows", "key"),
        ("methodKey", "/api/v1/payments/methods", "key"),
    ] {
        let harvested_values = harvest_field(api_client, list_path, field_name).await;
        path_values
            .entry(parameter_name.to_owned())
            .or_default()
            .extend(harvested_values);
    }
    path_values.insert("endpointId".to_owned(), vec![endpoint_id.to_owned()]);
    path_values.insert(
        "stack".to_owned(),
        INTEGRATION_STACKS
            .iter()
            .map(|stack| (*stack).to_owned())
            .collect(),
    );
    path_values
}

/// Every place one of the secrets appears, with a little of the text around it.
fn find_leaks(planted_secrets: &[PlantedSecret], swept_answers: &[SweptAnswer]) -> Vec<String> {
    let mut leaks = Vec::new();
    for swept_answer in swept_answers {
        for planted_secret in planted_secrets {
            let leaked_form = planted_secret
                .searched_forms
                .iter()
                .filter(|searched_form| !searched_form.is_empty())
                .find(|searched_form| swept_answer.text.contains(searched_form.as_str()));
            if let Some(leaked_form) = leaked_form {
                let leak_start = swept_answer
                    .text
                    .find(leaked_form.as_str())
                    .unwrap_or_default();
                let excerpt: String = swept_answer.text[leak_start.saturating_sub(80)..]
                    .chars()
                    .take(200)
                    .collect();
                leaks.push(format!(
                    "the {} is in {}: ...{excerpt}...",
                    planted_secret.kind, swept_answer.surface
                ));
            }
        }
    }
    leaks
}

// AC: PL-06.3
// AC: WH-01.3
#[tokio::test(flavor = "multi_thread")]
async fn no_secret_appears_in_any_api_answer_log_line_mcp_result_or_export() {
    let working_directory =
        tempfile::tempdir().unwrap_or_else(|error| panic!("a temp dir: {error}"));
    let smtp_port = find_free_port();
    let server = start_server(working_directory.path(), smtp_port);
    let ready_addresses = server.wait_for_ready_addresses();
    let api_client = ApiClient::new(&ready_addresses.http_addr, API_TOKEN);
    let responder_addr =
        start_ok_responder().unwrap_or_else(|error| panic!("a responder: {error}"));

    let mut planted_secrets = access_secrets();
    let (endpoint_id, webhook_secrets) = plant_webhook_secrets(&api_client, &responder_addr).await;
    planted_secrets.extend(webhook_secrets);
    planted_secrets.extend(plant_provider_secrets(&api_client).await);
    planted_secrets.extend(
        plant_smtp_and_relay_secrets(&api_client, &ready_addresses.smtp_addr, smtp_port).await,
    );
    let path_values = collect_path_values(&api_client, &endpoint_id).await;
    let mut swept_answers = sweep_rest_answers(&api_client, &path_values).await;
    let mut mcp_session = McpSession::start(
        working_directory.path(),
        &ready_addresses.http_addr,
        &["--toolsets", "all", "--read-only", "--token", API_TOKEN],
    )
    .unwrap_or_else(|error| panic!("sendmock mcp starts: {error}"));
    swept_answers.extend(sweep_mcp_answers(&mut mcp_session, &path_values));
    let log_lines = server.read_printed_lines(Duration::from_secs(1));
    swept_answers.push(SweptAnswer {
        surface: "the log output".to_owned(),
        text: log_lines.join("\n"),
    });

    assert_sweep_covered_everything(&swept_answers, &log_lines, &path_values);
    let leaks = find_leaks(&planted_secrets, &swept_answers);
    assert!(
        leaks.is_empty(),
        "{} leaks:\n{}",
        leaks.len(),
        leaks.join("\n")
    );
}

/// Guards against a sweep that passes because it read nothing: the export, the request log,
/// the deliveries, both relayed and authenticated mail and debug logging were all reached.
fn assert_sweep_covered_everything(
    swept_answers: &[SweptAnswer],
    log_lines: &[String],
    path_values: &PathValues,
) {
    let was_read = |surface_start: &str| {
        swept_answers.iter().any(|swept_answer| {
            swept_answer.surface.starts_with(surface_start)
                && swept_answer.surface.contains("(200)")
        })
    };
    for surface_start in [
        "GET /api/v1/seed/export",
        "GET /api/v1/settings",
        "GET /api/v1/logs/http/",
        "GET /api/v1/logs/smtp/",
        "GET /api/v1/webhooks/deliveries/",
        "GET /api/v1/webhooks/endpoints/",
        "GET /api/v1/sms/providers/twilio",
        "GET /api/v1/payments/gateways/stripe",
    ] {
        assert!(
            was_read(surface_start),
            "the sweep never read {surface_start}"
        );
    }
    assert!(
        swept_answers
            .iter()
            .any(|swept_answer| swept_answer.surface.starts_with("MCP sendmock_seed_export")),
        "the sweep never called the seed export tool"
    );
    assert!(
        path_values["emailId"].len() >= 3,
        "two mails with AUTH and the released copy: {:?}",
        path_values["emailId"]
    );
    assert!(log_lines.len() > 1, "the server logged: {log_lines:?}");
}
