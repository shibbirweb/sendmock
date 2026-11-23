use super::twilio_account_directory::TwilioAccountDirectory;
use super::twilio_subaccount_builder::{build_subaccount, generate_account_sid, is_account_sid};
use super::twilio_subaccount_inputs::{
    TwilioSubaccountInput, TwilioSubaccountReference, TwilioSubaccountUpdate,
};
use super::twilio_subaccount_views::{TwilioSubaccount, TwilioSubaccountTokenReveal};
use crate::numbers::field_error;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

pub struct ListTwilioSubaccountsOperation;

impl Operation for ListTwilioSubaccountsOperation {
    type Input = NoInput;
    type Output = Vec<TwilioSubaccount>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getTwilioSubaccounts",
            method: HttpMethod::Get,
            path: "/api/v1/twilio/subaccounts",
            summary: "Subaccounts of the Twilio provider's main account, tokens masked.",
            is_read_only: true,
            cli_usage: "sendmock sms twilio subaccounts list",
            mcp_tool: "sendmock_twilio_subaccount_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<TwilioSubaccount>, OperationError> {
        let stored_subaccounts = operation_context
            .twilio_subaccount_repository
            .list_subaccounts()
            .await?;
        Ok(stored_subaccounts
            .into_iter()
            .map(TwilioSubaccount::from)
            .collect())
    }
}

pub struct CreateTwilioSubaccountOperation;

impl Operation for CreateTwilioSubaccountOperation {
    type Input = TwilioSubaccountInput;
    type Output = TwilioSubaccount;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postTwilioSubaccounts",
            method: HttpMethod::Post,
            path: "/api/v1/twilio/subaccounts",
            summary: "Add a Twilio subaccount with its own auth token.",
            cli_usage: "sendmock sms twilio subaccounts create",
            mcp_tool: "sendmock_twilio_subaccount_create",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// A SID that is taken, by the main account or another subaccount, is refused.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: TwilioSubaccountInput,
    ) -> Result<TwilioSubaccount, OperationError> {
        let account_sid = match input.account_sid.map(|sid| sid.trim().to_owned()) {
            Some(account_sid) if !account_sid.is_empty() => {
                if !is_account_sid(&account_sid) {
                    return Err(field_error(
                        "account_sid",
                        "An account SID is AC and 32 hex digits",
                    ));
                }
                account_sid
            }
            _ => generate_account_sid(operation_context),
        };
        let directory = TwilioAccountDirectory::load(operation_context).await?;
        if directory.find_account(&account_sid).is_some() {
            return Err(OperationError::Conflict {
                code: "account_exists",
                message: format!("A Twilio account with SID {account_sid} already exists"),
            });
        }
        let new_subaccount = build_subaccount(operation_context, account_sid, input.changes, None)?;
        operation_context
            .twilio_subaccount_repository
            .save_subaccount(new_subaccount.clone())
            .await?;
        Ok(TwilioSubaccount::from(new_subaccount))
    }
}

pub struct UpdateTwilioSubaccountOperation;

impl Operation for UpdateTwilioSubaccountOperation {
    type Input = TwilioSubaccountUpdate;
    type Output = TwilioSubaccount;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchTwilioSubaccountsByAccountSid",
            method: HttpMethod::Patch,
            path: "/api/v1/twilio/subaccounts/{accountSid}",
            summary: "Change a Twilio subaccount's name, status, token or Debugger URL.",
            cli_usage: "sendmock sms twilio subaccounts update <accountSid>",
            mcp_tool: "sendmock_twilio_subaccount_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: TwilioSubaccountUpdate,
    ) -> Result<TwilioSubaccount, OperationError> {
        let existing_subaccount = find_existing(operation_context, &input.account_sid).await?;
        let merged_changes = input
            .changes
            .merge_onto(&TwilioSubaccount::from(existing_subaccount.clone()))?;
        let changed_subaccount = build_subaccount(
            operation_context,
            input.account_sid,
            merged_changes,
            Some(existing_subaccount),
        )?;
        operation_context
            .twilio_subaccount_repository
            .save_subaccount(changed_subaccount.clone())
            .await?;
        Ok(TwilioSubaccount::from(changed_subaccount))
    }
}

pub struct DeleteTwilioSubaccountOperation;

impl Operation for DeleteTwilioSubaccountOperation {
    type Input = TwilioSubaccountReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteTwilioSubaccountsByAccountSid",
            method: HttpMethod::Delete,
            path: "/api/v1/twilio/subaccounts/{accountSid}",
            summary: "Remove a Twilio subaccount; its messages stay.",
            is_destructive: true,
            cli_usage: "sendmock sms twilio subaccounts delete <accountSid>",
            mcp_tool: "sendmock_twilio_subaccount_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Removing a missing subaccount succeeds.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: TwilioSubaccountReference,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .twilio_subaccount_repository
            .delete_subaccount(&input.account_sid)
            .await?;
        Ok(NoContent)
    }
}

pub struct RevealTwilioSubaccountTokenOperation;

impl Operation for RevealTwilioSubaccountTokenOperation {
    type Input = TwilioSubaccountReference;
    type Output = TwilioSubaccountTokenReveal;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getTwilioSubaccountsByAccountSidAuthToken",
            method: HttpMethod::Get,
            path: "/api/v1/twilio/subaccounts/{accountSid}/auth-token",
            summary: "Reveal a subaccount's auth token (asked for after a confirmation).",
            is_read_only: true,
            cli_usage: "sendmock sms twilio subaccounts token <accountSid> --reveal",
            revealed_secret_field: Some("auth_token"),
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: TwilioSubaccountReference,
    ) -> Result<TwilioSubaccountTokenReveal, OperationError> {
        let stored_subaccount = find_existing(operation_context, &input.account_sid).await?;
        Ok(TwilioSubaccountTokenReveal {
            account_sid: stored_subaccount.account_sid,
            auth_token: stored_subaccount.auth_token,
        })
    }
}

async fn find_existing(
    operation_context: &OperationContext,
    account_sid: &str,
) -> Result<sendmock_store::TwilioSubaccountRecord, OperationError> {
    operation_context
        .twilio_subaccount_repository
        .find_subaccount(account_sid)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No Twilio subaccount with SID {account_sid}"),
        })
}
