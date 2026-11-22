#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::sync::Arc;

use sendmock_ops::{
    ENCRYPTED_SECRET_PREFIX, EncryptedSecretWriter, FixedEnvironment, OperationContext,
    SetupFileFormat, SetupImportOptions, apply_setup_text, check_setup_text, write_setup_text,
};
use serde_json::json;
use support::test_app::{build_test_app, build_test_app_with, call_api};

const PASSPHRASE: &str = "correct horse battery";
const ENDPOINT_SECRET: &str = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const VARIABLE_SECRET: &str = "sk_test_variable_secret";
const GATEWAY_SECRET: &str = "upay \"quoted\" secret";

const SECRETS_SETUP: &str = r#"[[webhook.endpoints]]
name = "Billing"
url = "http://localhost:8000/hook"
secret = "${BILLING_SECRET}"

[[webhook.variables]]
name = "api_key"
kind = "secret"
value = "${API_KEY_SECRET}"
"#;

/// An instance holding a secret of every kind an export writes: an endpoint's signing secret,
/// a secret variable and a gateway's secret credential (inside its definition JSON).
async fn build_instance_with_secrets() -> (axum::Router, OperationContext) {
    let environment = FixedEnvironment::default()
        .with_variable("BILLING_SECRET", ENDPOINT_SECRET)
        .with_variable("API_KEY_SECRET", VARIABLE_SECRET);
    let (app_router, operation_context) = build_test_app_with(|operation_context| {
        operation_context.with_environment_reader(Arc::new(environment))
    });
    import_setup(
        &operation_context,
        SECRETS_SETUP,
        SetupFileFormat::Toml,
        None,
    )
    .await
    .unwrap_or_else(|error| panic!("the secrets setup applies: {error}"));
    add_gateway_with_secret(&app_router).await;
    (app_router, operation_context)
}

async fn add_gateway_with_secret(app_router: &axum::Router) {
    let new_gateway = json!({ "name": "Upay", "key": "upay_gateway", "start_from": null });
    let (status, answer) = call_api(
        app_router,
        "POST",
        "/api/v1/payments/gateways",
        Some(&new_gateway),
    )
    .await;
    assert_eq!(status, 201, "{answer}");
    let (_, mut upay_gateway) = call_api(
        app_router,
        "GET",
        "/api/v1/payments/gateways/upay_gateway",
        None,
    )
    .await;
    upay_gateway["credentials"] = json!([
        { "name": "api_secret", "value": GATEWAY_SECRET, "is_secret": true },
    ]);
    let (status, answer) = call_api(
        app_router,
        "PATCH",
        "/api/v1/payments/gateways/upay_gateway",
        Some(&upay_gateway),
    )
    .await;
    assert_eq!(status, 200, "{answer}");
}

async fn export_encrypted(
    operation_context: &OperationContext,
    setup_format: SetupFileFormat,
) -> String {
    let secret_writer =
        EncryptedSecretWriter::new(PASSPHRASE, operation_context.random_source.clone())
            .unwrap_or_else(|error| panic!("a writer: {error}"));
    write_setup_text(operation_context, setup_format, &secret_writer)
        .await
        .unwrap_or_else(|error| panic!("{setup_format:?} exports: {error}"))
}

async fn import_setup(
    operation_context: &OperationContext,
    setup_text: &str,
    setup_format: SetupFileFormat,
    passphrase: Option<&str>,
) -> Result<(), sendmock_ops::OperationError> {
    apply_setup_text(
        operation_context,
        setup_text,
        setup_format,
        SetupImportOptions {
            passphrase: passphrase.map(str::to_owned),
            ..SetupImportOptions::default()
        },
    )
    .await
    .map(|_| ())
}

/// The endpoint's signing secret, the variable's value and the gateway's credential as stored.
async fn read_stored_secrets(
    app_router: &axum::Router,
    operation_context: &OperationContext,
) -> Vec<String> {
    let endpoints = operation_context
        .webhook_endpoint_repository
        .list_endpoints()
        .await
        .unwrap_or_else(|error| panic!("endpoints: {error}"));
    let variables = operation_context
        .webhook_variable_repository
        .list_variables(None)
        .await
        .unwrap_or_else(|error| panic!("variables: {error}"));
    let (_, gateway_credential) = call_api(
        app_router,
        "GET",
        "/api/v1/payments/gateways/upay_gateway/credentials/api_secret",
        None,
    )
    .await;
    let endpoint_secret = endpoints
        .first()
        .map(|endpoint| endpoint.signing_secret.clone());
    let variable_secret = variables.first().map(|variable| variable.value.clone());
    vec![
        endpoint_secret.unwrap_or_default(),
        variable_secret.unwrap_or_default(),
        gateway_credential["value"]
            .as_str()
            .unwrap_or_default()
            .to_owned(),
    ]
}

fn expected_secrets() -> Vec<String> {
    [ENDPOINT_SECRET, VARIABLE_SECRET, GATEWAY_SECRET]
        .map(str::to_owned)
        .to_vec()
}

// AC: PL-18.6
#[tokio::test]
async fn encrypted_secrets_move_to_a_fresh_instance_with_the_passphrase() {
    let (_, source_context) = build_instance_with_secrets().await;

    for setup_format in [SetupFileFormat::Toml, SetupFileFormat::Json] {
        let setup_text = export_encrypted(&source_context, setup_format).await;
        let (target_router, target_context) = build_test_app();

        import_setup(&target_context, &setup_text, setup_format, Some(PASSPHRASE))
            .await
            .unwrap_or_else(|error| panic!("{setup_format:?} imports: {error}\n{setup_text}"));

        assert_eq!(
            setup_text.matches(ENCRYPTED_SECRET_PREFIX).count(),
            3,
            "{setup_text}"
        );
        for secret_value in [
            "MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
            VARIABLE_SECRET,
            "quoted",
        ] {
            assert!(!setup_text.contains(secret_value), "{setup_text}");
        }
        assert!(check_setup_text(&setup_text, setup_format).is_valid());
        assert_eq!(
            read_stored_secrets(&target_router, &target_context).await,
            expected_secrets()
        );
    }
}

// AC: PL-18.6
#[tokio::test]
async fn without_the_passphrase_or_with_a_wrong_one_nothing_is_applied() {
    let (_, source_context) = build_instance_with_secrets().await;
    let setup_text = export_encrypted(&source_context, SetupFileFormat::Toml).await;

    for (passphrase, expected_code) in [
        (None, "setup_passphrase_required"),
        (Some("not the passphrase"), "setup_passphrase_wrong"),
    ] {
        let (_, target_context) = build_test_app();

        let import_error = import_setup(
            &target_context,
            &setup_text,
            SetupFileFormat::Toml,
            passphrase,
        )
        .await
        .err()
        .unwrap_or_else(|| panic!("an import must be refused with {expected_code}"));

        assert_eq!(import_error.code(), expected_code);
        let stored_endpoints = target_context
            .webhook_endpoint_repository
            .list_endpoints()
            .await
            .unwrap_or_else(|error| panic!("endpoints: {error}"));
        assert!(stored_endpoints.is_empty(), "nothing applied");
    }
}

// AC: PL-18.6
#[tokio::test]
async fn the_seed_state_keeps_no_secret_and_reset_keeps_the_imported_ones() {
    let (_, source_context) = build_instance_with_secrets().await;
    let setup_text = export_encrypted(&source_context, SetupFileFormat::Toml).await;
    let (target_router, target_context) = build_test_app();
    import_setup(
        &target_context,
        &setup_text,
        SetupFileFormat::Toml,
        Some(PASSPHRASE),
    )
    .await
    .unwrap_or_else(|error| panic!("imports: {error}"));

    let (status, answer) = call_api(&target_router, "POST", "/api/v1/reset", None).await;

    assert_eq!(status, 200, "{answer}");
    let seed_state = target_context
        .setup_stores
        .seed_state
        .find_state()
        .await
        .unwrap_or_else(|error| panic!("the seed state: {error}"))
        .unwrap_or_else(|| panic!("a seed state"));
    assert!(!seed_state.seed_toml.contains(ENCRYPTED_SECRET_PREFIX));
    for secret_value in expected_secrets() {
        assert!(!seed_state.seed_toml.contains(&secret_value));
    }
    assert_eq!(
        read_stored_secrets(&target_router, &target_context).await,
        expected_secrets()
    );
}
