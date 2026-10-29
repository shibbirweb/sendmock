use sendmock_store::VerifyServiceRecord;

use super::verify_inputs::{VerifyServiceInput, VerifyServiceReference, VerifyServiceUpdate};
use super::verify_views::VerifyService;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

const MAXIMUM_NAME_CHARACTERS: usize = 64;
const CODE_LENGTH_RANGE: std::ops::RangeInclusive<u32> = 4..=10;
const TTL_SECONDS_RANGE: std::ops::RangeInclusive<u32> = 60..=86_400;

fn field_error(field_name: &str, message: String) -> OperationError {
    OperationError::InvalidInput {
        message,
        field: Some(field_name.to_owned()),
    }
}

/// The service as it will be stored, checked as the form checks it.
fn build_verify_service(
    input: VerifyServiceInput,
    existing_service: VerifyServiceRecord,
) -> Result<VerifyServiceRecord, OperationError> {
    let friendly_name = input.friendly_name.trim().to_owned();
    if friendly_name.is_empty() {
        return Err(field_error("friendly_name", "Enter a name".to_owned()));
    }
    if friendly_name.chars().count() > MAXIMUM_NAME_CHARACTERS {
        return Err(field_error(
            "friendly_name",
            format!("Use at most {MAXIMUM_NAME_CHARACTERS} characters"),
        ));
    }
    if !CODE_LENGTH_RANGE.contains(&input.code_length) {
        return Err(field_error(
            "code_length",
            "Choose 4 to 10 digits".to_owned(),
        ));
    }
    let fixed_code = input
        .fixed_code
        .map(|fixed_code| fixed_code.trim().to_owned())
        .filter(|fixed_code| !fixed_code.is_empty());
    if let Some(fixed_code) = &fixed_code {
        if !fixed_code
            .chars()
            .all(|character| character.is_ascii_digit())
        {
            return Err(field_error("fixed_code", "Use digits only".to_owned()));
        }
        if fixed_code.len() != input.code_length as usize {
            return Err(field_error(
                "fixed_code",
                format!("Use exactly {} digits", input.code_length),
            ));
        }
    }
    if !TTL_SECONDS_RANGE.contains(&input.ttl_seconds) {
        return Err(field_error(
            "ttl_seconds",
            "Choose 1 minute to 24 hours".to_owned(),
        ));
    }
    Ok(VerifyServiceRecord {
        friendly_name,
        code_length: input.code_length,
        fixed_code,
        ttl_seconds: input.ttl_seconds,
        ..existing_service
    })
}

/// `VA` and 32 hex digits, as Twilio writes Verify service SIDs.
pub fn new_verify_service(operation_context: &OperationContext) -> VerifyServiceRecord {
    let random_source = &operation_context.random_source;
    VerifyServiceRecord {
        service_sid: format!(
            "VA{:016x}{:016x}",
            random_source.next_u64(),
            random_source.next_u64()
        ),
        friendly_name: String::new(),
        code_length: 6,
        fixed_code: None,
        ttl_seconds: 600,
        created_by: "api".to_owned(),
        created_at_unix_ms: operation_context.clock.now_unix_ms(),
    }
}

pub async fn find_service_or_not_found(
    operation_context: &OperationContext,
    service_sid: &str,
) -> Result<VerifyServiceRecord, OperationError> {
    operation_context
        .verify_service_repository
        .find_service(service_sid)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No Verify service with SID {service_sid}"),
        })
}

fn service_definition(
    operation_id: &'static str,
    method: HttpMethod,
    path: &'static str,
    summary: &'static str,
    cli_usage: &'static str,
    mcp_tool: &'static str,
) -> OperationDefinition {
    OperationDefinition {
        operation_id,
        method,
        path,
        summary,
        cli_usage,
        mcp_tool,
        ..OperationDefinition::DEFAULTS
    }
}

pub struct ListVerifyServicesOperation;

impl Operation for ListVerifyServicesOperation {
    type Input = NoInput;
    type Output = Vec<VerifyService>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..service_definition(
                "getVerifyServices",
                HttpMethod::Get,
                "/api/v1/verify/services",
                "Verify services (code length, fixed code, lifetime).",
                "sendmock verify services list",
                "sendmock_verify_service_list",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<VerifyService>, OperationError> {
        let stored_services = operation_context
            .verify_service_repository
            .list_services()
            .await?;
        Ok(stored_services
            .into_iter()
            .map(VerifyService::from)
            .collect())
    }
}

pub struct CreateVerifyServiceOperation;

impl Operation for CreateVerifyServiceOperation {
    type Input = VerifyServiceInput;
    type Output = VerifyService;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            success_status: SuccessStatus::Created,
            ..service_definition(
                "postVerifyServices",
                HttpMethod::Post,
                "/api/v1/verify/services",
                "Add a Verify service.",
                "sendmock verify services create",
                "sendmock_verify_service_create",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: VerifyServiceInput,
    ) -> Result<VerifyService, OperationError> {
        let new_service = build_verify_service(input, new_verify_service(operation_context))?;
        operation_context
            .verify_service_repository
            .save_service(new_service.clone())
            .await?;
        Ok(VerifyService::from(new_service))
    }
}

pub struct UpdateVerifyServiceOperation;

impl Operation for UpdateVerifyServiceOperation {
    type Input = VerifyServiceUpdate;
    type Output = VerifyService;

    fn definition(&self) -> OperationDefinition {
        service_definition(
            "patchVerifyServicesByServiceSid",
            HttpMethod::Patch,
            "/api/v1/verify/services/{serviceSid}",
            "Change a Verify service.",
            "sendmock verify services update <serviceSid>",
            "sendmock_verify_service_update",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: VerifyServiceUpdate,
    ) -> Result<VerifyService, OperationError> {
        let existing_service =
            find_service_or_not_found(operation_context, &input.service_sid).await?;
        let changed_service = build_verify_service(input.changes, existing_service)?;
        operation_context
            .verify_service_repository
            .save_service(changed_service.clone())
            .await?;
        Ok(VerifyService::from(changed_service))
    }
}

pub struct DeleteVerifyServiceOperation;

impl Operation for DeleteVerifyServiceOperation {
    type Input = VerifyServiceReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_destructive: true,
            success_status: SuccessStatus::NoContent,
            ..service_definition(
                "deleteVerifyServicesByServiceSid",
                HttpMethod::Delete,
                "/api/v1/verify/services/{serviceSid}",
                "Delete a Verify service.",
                "sendmock verify services delete <serviceSid>",
                "sendmock_verify_service_delete",
            )
        }
    }

    /// Its verifications stay, with the service's name; deleting a missing service succeeds.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: VerifyServiceReference,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .verify_service_repository
            .delete_service(&input.service_sid)
            .await?;
        Ok(NoContent)
    }
}
