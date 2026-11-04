use sendmock_store::WebhookVariableRecord;
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::endpoint_names::EndpointNames;
use crate::seed::seed_section_adapter::{
    CREATED_BY_SEED, SeedItem, impl_seed_section_adapter, read_seed_table, to_api_input,
    to_secret_reference, write_seed_table,
};
use crate::seed::seed_sections::WEBHOOK_VARIABLES_SECTION;
use crate::webhooks::{WebhookVariableInput, generate_fixed_value, validate_variable};
use crate::{OperationContext, OperationError};

const SECRET_KIND: &str = "secret";

/// `[[webhook.variables]]`, matched by `endpoint` (left out for a global one) and `name`. A
/// secret's `value` must be an `${ENV_VAR}` reference; export writes one.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedWebhookVariable {
    name: String,
    kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    endpoint: Option<String>,
    #[serde(default)]
    value: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    random_mode: Option<String>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    description: String,
}

fn variable_key(endpoint_name: Option<&str>, variable_name: &str) -> String {
    format!("{} {variable_name}", endpoint_name.unwrap_or_default())
}

pub struct WebhookVariableSeedAdapter;

impl WebhookVariableSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_variable: SeedWebhookVariable = read_seed_table(item_table)?;
        let endpoint_id = match seed_variable.endpoint.as_deref() {
            Some(endpoint_name) => Some(
                EndpointNames::load(operation_context)
                    .await?
                    .find_id(endpoint_name)?,
            ),
            None => None,
        };
        let variable_input: WebhookVariableInput = to_api_input(json!({
            "name": seed_variable.name,
            "kind": seed_variable.kind,
            "scope": if endpoint_id.is_some() { "endpoint" } else { "global" },
            "endpoint_id": endpoint_id,
            "value": seed_variable.value,
            "random_mode": seed_variable.random_mode,
            "description": seed_variable.description,
        }))?;
        let variable_repository = &operation_context.webhook_variable_repository;
        let existing_variable = variable_repository
            .list_variables(None)
            .await?
            .into_iter()
            .find(|stored_variable| {
                stored_variable.name == variable_input.name
                    && stored_variable.endpoint_id == variable_input.endpoint_id
            });
        let endpoint_id = validate_variable(
            operation_context,
            &variable_input,
            existing_variable.as_ref(),
        )
        .await?;
        let seeded_variable = build_seeded_variable(
            operation_context,
            variable_input,
            endpoint_id,
            existing_variable.as_ref(),
        )
        .await?;
        let item_key = variable_key(seed_variable.endpoint.as_deref(), &seeded_variable.name);
        if existing_variable.is_some() {
            variable_repository.update_variable(seeded_variable).await?;
        } else {
            variable_repository.insert_variable(seeded_variable).await?;
        }
        Ok(item_key)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let endpoint_names = EndpointNames::load(operation_context).await?;
        let stored_variables = operation_context
            .webhook_variable_repository
            .list_variables(None)
            .await?;
        stored_variables
            .into_iter()
            .map(|stored_variable| {
                let endpoint_name = stored_variable
                    .endpoint_id
                    .as_deref()
                    .and_then(|endpoint_id| endpoint_names.find_name(endpoint_id));
                let value = if stored_variable.kind == SECRET_KIND {
                    to_secret_reference(&stored_variable.name)
                } else {
                    stored_variable.value
                };
                Ok(SeedItem {
                    item_key: variable_key(endpoint_name.as_deref(), &stored_variable.name),
                    item_name: stored_variable.name.clone(),
                    table: write_seed_table(&SeedWebhookVariable {
                        name: stored_variable.name,
                        kind: stored_variable.kind,
                        endpoint: endpoint_name,
                        value,
                        random_mode: stored_variable.random_mode,
                        description: stored_variable.description,
                    })?,
                })
            })
            .collect()
    }

    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let endpoint_names = EndpointNames::load(operation_context).await?;
        let variable_repository = &operation_context.webhook_variable_repository;
        for stored_variable in variable_repository.list_variables(None).await? {
            let endpoint_name = stored_variable
                .endpoint_id
                .as_deref()
                .and_then(|endpoint_id| endpoint_names.find_name(endpoint_id));
            if !kept_item_keys.contains(&variable_key(
                endpoint_name.as_deref(),
                &stored_variable.name,
            )) {
                variable_repository
                    .delete_variable(&stored_variable.variable_id)
                    .await?;
            }
        }
        Ok(())
    }
}

/// The record as stored: an empty secret keeps the stored value (an unset `${ENV_VAR}`), and a
/// Fixed random variable keeps its value until its generator changes.
async fn build_seeded_variable(
    operation_context: &OperationContext,
    variable_input: WebhookVariableInput,
    endpoint_id: Option<String>,
    existing_variable: Option<&WebhookVariableRecord>,
) -> Result<WebhookVariableRecord, OperationError> {
    let kind = variable_input.kind.as_str().to_owned();
    let random_mode = variable_input
        .random_mode
        .filter(|_| kind == "random")
        .map(|random_mode| random_mode.as_str().to_owned());
    let value = match existing_variable {
        Some(existing_variable) if kind == SECRET_KIND && variable_input.value.is_empty() => {
            existing_variable.value.clone()
        }
        _ => variable_input.value,
    };
    let kept_fixed_value = existing_variable
        .filter(|existing_variable| existing_variable.value == value)
        .and_then(|existing_variable| existing_variable.fixed_value.clone());
    let fixed_value = match (random_mode.as_deref(), kept_fixed_value) {
        (Some("fixed"), Some(kept_fixed_value)) => Some(kept_fixed_value),
        (Some("fixed"), None) => Some(generate_fixed_value(operation_context, &value).await?),
        _ => None,
    };
    Ok(WebhookVariableRecord {
        variable_id: existing_variable.map_or_else(
            || operation_context.id_generator.generate_id().to_string(),
            |existing_variable| existing_variable.variable_id.clone(),
        ),
        name: variable_input.name,
        kind,
        endpoint_id,
        value,
        random_mode,
        fixed_value,
        description: variable_input.description.trim().to_owned(),
        created_by: existing_variable.map_or_else(
            || CREATED_BY_SEED.to_owned(),
            |existing_variable| existing_variable.created_by.clone(),
        ),
        created_at_unix_ms: existing_variable.map_or_else(
            || operation_context.clock.now_unix_ms(),
            |existing_variable| existing_variable.created_at_unix_ms,
        ),
    })
}

impl_seed_section_adapter!(WebhookVariableSeedAdapter, WEBHOOK_VARIABLES_SECTION);
