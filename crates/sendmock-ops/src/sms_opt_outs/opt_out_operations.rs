use super::opt_out_views::{SmsOptOut, SmsOptOutReference};
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

pub struct ListSmsOptOutsOperation;

impl Operation for ListSmsOptOutsOperation {
    type Input = NoInput;
    type Output = Vec<SmsOptOut>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getSmsOptOuts",
            method: HttpMethod::Get,
            path: "/api/v1/sms/opt-outs",
            summary: "Contacts who texted STOP, newest first.",
            cli_usage: "sendmock sms opt-outs list",
            mcp_tool: "sendmock_sms_opt_out_list",
            is_read_only: true,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<SmsOptOut>, OperationError> {
        let stored_opt_outs = operation_context
            .sms_delivery_stores
            .opt_outs
            .list_opt_outs()
            .await?;
        Ok(stored_opt_outs.into_iter().map(SmsOptOut::from).collect())
    }
}

pub struct DeleteSmsOptOutOperation;

impl Operation for DeleteSmsOptOutOperation {
    type Input = SmsOptOutReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteSmsOptOutsBySenderByContactNumber",
            method: HttpMethod::Delete,
            path: "/api/v1/sms/opt-outs/{sender}/{contactNumber}",
            summary: "Lift one opt-out, as if the contact texted START.",
            is_destructive: true,
            cli_usage: "sendmock sms opt-outs delete <sender> <contactNumber>",
            mcp_tool: "sendmock_sms_opt_out_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmsOptOutReference,
    ) -> Result<NoContent, OperationError> {
        let was_lifted = operation_context
            .sms_delivery_stores
            .opt_outs
            .delete_opt_out(input.sender.trim(), input.contact_number.trim())
            .await?;
        if !was_lifted {
            return Err(OperationError::NotFound {
                message: format!(
                    "{} has not opted out of {}",
                    input.contact_number, input.sender
                ),
            });
        }
        Ok(NoContent)
    }
}

pub struct DeleteAllSmsOptOutsOperation;

impl Operation for DeleteAllSmsOptOutsOperation {
    type Input = NoInput;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteSmsOptOuts",
            method: HttpMethod::Delete,
            path: "/api/v1/sms/opt-outs",
            summary: "Lift every opt-out.",
            is_destructive: true,
            cli_usage: "sendmock sms opt-outs clear --yes",
            mcp_tool: "sendmock_sms_opt_out_clear",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .sms_delivery_stores
            .opt_outs
            .delete_all_opt_outs()
            .await?;
        Ok(NoContent)
    }
}
