//! The payload template an endpoint renders in Template body mode (WH-09.2): a linked endpoint
//! follows the template as it is now, a detached one keeps the copy taken when it detached.

use sendmock_store::WebhookEndpointRecord;

use super::endpoint_settings::{EndpointRequestSettings, TemplateMode};
use super::endpoint_view::read_request_settings;
use super::template_catalogue::{NATIVE_TEMPLATE_ID, find_builtin_template};
use super::template_store::find_resolved_template;
use super::template_view::TemplateDraft;
use crate::{OperationContext, OperationError};

/// What Template body mode sends.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EndpointTemplate {
    /// The shipped native shape: the Standard Webhooks event as JSON.
    NativeEvent,
    /// Any other template, or an edited native one, rendered from its request shape.
    Draft(TemplateDraft),
    /// The template is gone, so the request cannot be rendered.
    Missing { template_id: String },
}

pub fn read_detached_template(
    stored_endpoint: &WebhookEndpointRecord,
) -> Result<Option<TemplateDraft>, OperationError> {
    stored_endpoint
        .detached_template_json
        .as_deref()
        .map(serde_json::from_str)
        .transpose()
        .map_err(|parse_error| {
            OperationError::Internal(format!(
                "the template copy of endpoint {} does not parse: {parse_error}",
                stored_endpoint.endpoint_id
            ))
        })
}

pub fn write_detached_template(
    detached_template: Option<&TemplateDraft>,
) -> Result<Option<String>, OperationError> {
    detached_template
        .map(serde_json::to_string)
        .transpose()
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))
}

/// The template's request shape as it is now; an unknown id is the caller's mistake.
async fn find_current_draft(
    operation_context: &OperationContext,
    template_id: &str,
) -> Result<TemplateDraft, OperationError> {
    match find_resolved_template(operation_context, template_id).await {
        Ok(resolved_template) => Ok(resolved_template.draft),
        Err(OperationError::NotFound { message }) => Err(OperationError::InvalidInput {
            message,
            field: Some("template_id".to_owned()),
        }),
        Err(other_error) => Err(other_error),
    }
}

/// The copy a saved endpoint keeps: none while linked, the earlier copy while it stays detached
/// from the same template, otherwise the template as it is now.
pub async fn choose_detached_template(
    operation_context: &OperationContext,
    request_settings: &EndpointRequestSettings,
    stored_endpoint: Option<&WebhookEndpointRecord>,
) -> Result<Option<TemplateDraft>, OperationError> {
    let current_draft = find_current_draft(operation_context, &request_settings.template_id).await?;
    if request_settings.template_mode == TemplateMode::Linked {
        return Ok(None);
    }
    if let Some(stored_endpoint) = stored_endpoint {
        let stored_settings = read_request_settings(stored_endpoint)?;
        let earlier_copy = read_detached_template(stored_endpoint)?;
        if stored_settings.template_id == request_settings.template_id && earlier_copy.is_some() {
            return Ok(earlier_copy);
        }
    }
    Ok(Some(current_draft))
}

/// The template an endpoint renders: its own copy when detached, otherwise the template now.
pub async fn resolve_endpoint_template(
    operation_context: &OperationContext,
    request_settings: &EndpointRequestSettings,
    detached_template: Option<&TemplateDraft>,
) -> Result<EndpointTemplate, OperationError> {
    let template_id = &request_settings.template_id;
    let draft = match detached_template {
        Some(detached_template) if request_settings.template_mode == TemplateMode::Detached => {
            detached_template.clone()
        }
        _ => match find_resolved_template(operation_context, template_id).await {
            Ok(resolved_template) => resolved_template.draft,
            Err(OperationError::NotFound { .. }) => {
                return Ok(EndpointTemplate::Missing {
                    template_id: template_id.clone(),
                });
            }
            Err(other_error) => return Err(other_error),
        },
    };
    let shipped_native_draft =
        find_builtin_template(NATIVE_TEMPLATE_ID).map(|native_template| native_template.draft);
    if shipped_native_draft.as_ref() == Some(&draft) {
        return Ok(EndpointTemplate::NativeEvent);
    }
    Ok(EndpointTemplate::Draft(draft))
}
