use sendmock_store::WebhookEndpointRecord;
use sendmock_webhooks::WebhookSecret;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::seed::seed_section_adapter::{
    CREATED_BY_SEED, SeedItem, impl_seed_section_adapter, read_seed_table, to_secret_reference,
    write_changed_fields, write_seed_table,
};
use crate::seed::seed_sections::WEBHOOK_ENDPOINTS_SECTION;
use crate::webhooks::{
    DeleteWebhookEndpointOperation, EndpointRequestSettings, WebhookEndpointInput,
    WebhookEndpointReference, choose_detached_template, read_request_settings,
    validate_endpoint_input, write_detached_template, write_request_settings,
};
use crate::{Operation, OperationContext, OperationError};

/// `[[webhook.endpoints]]`, matched by `name`. The request settings a file leaves out keep the
/// defaults a new endpoint gets in the UI; export writes only the ones that differ.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SeedWebhookEndpoint {
    name: String,
    url: String,
    #[serde(default = "default_enabled")]
    enabled: bool,
    #[serde(default = "default_template")]
    template: String,
    /// An `${ENV_VAR}` reference to a `whsec_` secret; none or empty keeps or generates one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    secret: Option<String>,
    #[serde(flatten)]
    request_settings: toml::Table,
}

fn default_enabled() -> bool {
    true
}

fn default_template() -> String {
    "native".to_owned()
}

/// What a new endpoint starts with in the UI.
fn default_request_settings() -> Value {
    json!({
        "method": "POST",
        "headers": {},
        "extra_fields": {},
        "template_id": "native",
        "template_mode": "linked",
        "timeout_ms": 10_000,
        "retry_policy": {
            "max_attempts": 5,
            "backoff_seconds": [1, 5, 30, 120, 600],
            "retry_on_client_errors": false,
        },
        "query_params": [],
        "body_mode": "template",
        "body_fields": [],
        "fields_encoding": "json",
        "raw_content_type": "application/json",
        "raw_body": "",
        "render_mode": "strict",
    })
}

fn invalid_field(field_name: &str, message: String) -> OperationError {
    OperationError::InvalidInput {
        message,
        field: Some(field_name.to_owned()),
    }
}

fn read_request_settings_fields(
    seed_endpoint: &SeedWebhookEndpoint,
) -> Result<EndpointRequestSettings, OperationError> {
    let mut settings_fields = default_request_settings();
    settings_fields["template_id"] = Value::from(seed_endpoint.template.clone());
    for (setting_name, setting_value) in &seed_endpoint.request_settings {
        if setting_name == "template_id" || settings_fields.get(setting_name).is_none() {
            return Err(invalid_field(
                setting_name,
                format!("{setting_name} is not an endpoint setting"),
            ));
        }
        settings_fields[setting_name] = serde_json::to_value(setting_value)
            .map_err(|read_error| OperationError::Internal(read_error.to_string()))?;
    }
    serde_json::from_value(settings_fields).map_err(|read_error| OperationError::InvalidInput {
        message: read_error.to_string(),
        field: None,
    })
}

fn read_seeded_secret(secret: Option<&str>) -> Result<Option<String>, OperationError> {
    match secret.map(str::trim).filter(|secret| !secret.is_empty()) {
        None => Ok(None),
        Some(secret) => WebhookSecret::parse(secret)
            .map(|parsed_secret| Some(parsed_secret.expose().to_owned()))
            .map_err(|_| invalid_field("secret", "secret must be a whsec_ secret".to_owned())),
    }
}

pub struct WebhookEndpointSeedAdapter;

impl WebhookEndpointSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_endpoint: SeedWebhookEndpoint = read_seed_table(item_table)?;
        let endpoint_input = WebhookEndpointInput {
            name: seed_endpoint.name.trim().to_owned(),
            url: seed_endpoint.url.trim().to_owned(),
            is_enabled: seed_endpoint.enabled,
            request_settings: read_request_settings_fields(&seed_endpoint)?,
        };
        validate_endpoint_input(&endpoint_input)?;
        let seeded_secret = read_seeded_secret(seed_endpoint.secret.as_deref())?;
        let existing_endpoint = operation_context
            .webhook_endpoint_repository
            .list_endpoints()
            .await?
            .into_iter()
            .find(|stored_endpoint| stored_endpoint.name == endpoint_input.name);
        let detached_template = choose_detached_template(
            operation_context,
            &endpoint_input.request_settings,
            existing_endpoint.as_ref(),
        )
        .await?;
        let seeded_endpoint = SeededEndpoint {
            request_settings_json: write_request_settings(&endpoint_input.request_settings)?,
            detached_template_json: write_detached_template(detached_template.as_ref())?,
            seeded_secret,
            endpoint_input,
        };
        let endpoint_name = seeded_endpoint.endpoint_input.name.clone();
        match existing_endpoint {
            Some(existing_endpoint) => {
                update_seeded_endpoint(operation_context, existing_endpoint, seeded_endpoint)
                    .await?;
            }
            None => insert_seeded_endpoint(operation_context, seeded_endpoint).await?,
        }
        Ok(endpoint_name)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let stored_endpoints = operation_context
            .webhook_endpoint_repository
            .list_endpoints()
            .await?;
        let mut seed_items = Vec::new();
        for stored_endpoint in stored_endpoints {
            let request_settings = read_request_settings(&stored_endpoint)?;
            let settings_fields = serde_json::to_value(&request_settings)
                .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
            seed_items.push(SeedItem {
                item_key: stored_endpoint.name.clone(),
                item_name: stored_endpoint.name.clone(),
                table: write_seed_table(&SeedWebhookEndpoint {
                    secret: Some(to_secret_reference(&stored_endpoint.name)),
                    name: stored_endpoint.name,
                    url: stored_endpoint.url,
                    enabled: stored_endpoint.is_enabled,
                    template: request_settings.template_id,
                    request_settings: write_changed_fields(
                        settings_fields,
                        &default_request_settings(),
                        &["template_id"],
                    )?,
                })?,
            });
        }
        Ok(seed_items)
    }

    /// Deletes through the API's operation, so the endpoint's rules and variables go with it.
    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let stored_endpoints = operation_context
            .webhook_endpoint_repository
            .list_endpoints()
            .await?;
        for stored_endpoint in stored_endpoints {
            if !kept_item_keys.contains(&stored_endpoint.name) {
                DeleteWebhookEndpointOperation
                    .execute(
                        operation_context,
                        WebhookEndpointReference {
                            endpoint_id: stored_endpoint.endpoint_id,
                        },
                    )
                    .await?;
            }
        }
        Ok(())
    }
}

/// An endpoint as the seed file has it, checked and ready to store.
struct SeededEndpoint {
    endpoint_input: WebhookEndpointInput,
    request_settings_json: String,
    detached_template_json: Option<String>,
    seeded_secret: Option<String>,
}

/// Keeps the endpoint's id, name and origin; a seeded secret replaces the stored one.
async fn update_seeded_endpoint(
    operation_context: &OperationContext,
    existing_endpoint: WebhookEndpointRecord,
    seeded_endpoint: SeededEndpoint,
) -> Result<(), OperationError> {
    let endpoint_repository = &operation_context.webhook_endpoint_repository;
    let endpoint_id = existing_endpoint.endpoint_id.clone();
    let current_secret = existing_endpoint.signing_secret.clone();
    endpoint_repository
        .update_endpoint(WebhookEndpointRecord {
            url: seeded_endpoint.endpoint_input.url,
            is_enabled: seeded_endpoint.endpoint_input.is_enabled,
            request_settings_json: seeded_endpoint.request_settings_json,
            detached_template_json: seeded_endpoint.detached_template_json,
            ..existing_endpoint
        })
        .await?;
    if let Some(seeded_secret) = seeded_endpoint
        .seeded_secret
        .filter(|seeded_secret| *seeded_secret != current_secret)
    {
        endpoint_repository
            .replace_signing_secret(&endpoint_id, seeded_secret)
            .await?;
    }
    Ok(())
}

/// A new endpoint with the seeded secret, or a generated one when the file has none.
async fn insert_seeded_endpoint(
    operation_context: &OperationContext,
    seeded_endpoint: SeededEndpoint,
) -> Result<(), OperationError> {
    let signing_secret = seeded_endpoint.seeded_secret.unwrap_or_else(|| {
        WebhookSecret::generate(operation_context.random_source.as_ref())
            .expose()
            .to_owned()
    });
    operation_context
        .webhook_endpoint_repository
        .insert_endpoint(WebhookEndpointRecord {
            endpoint_id: operation_context.id_generator.generate_id().to_string(),
            name: seeded_endpoint.endpoint_input.name,
            url: seeded_endpoint.endpoint_input.url,
            is_enabled: seeded_endpoint.endpoint_input.is_enabled,
            request_settings_json: seeded_endpoint.request_settings_json,
            detached_template_json: seeded_endpoint.detached_template_json,
            signing_secret,
            previous_signing_secret: None,
            previous_secret_expires_at_unix_ms: None,
            created_by: CREATED_BY_SEED.to_owned(),
            created_at_unix_ms: operation_context.clock.now_unix_ms(),
        })
        .await?;
    Ok(())
}

impl_seed_section_adapter!(WebhookEndpointSeedAdapter, WEBHOOK_ENDPOINTS_SECTION);
