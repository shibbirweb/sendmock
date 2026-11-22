use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::seed::seed_section_adapter::{
    CREATED_BY_SEED, SeedItem, impl_seed_section_adapter, read_seed_table, write_seed_table,
};
use crate::seed::seed_sections::TWILIO_SUBACCOUNTS_SECTION;
use crate::setup::SetupSecretWriter;
use crate::twilio_accounts::{
    TwilioAccountStatus, TwilioSubaccountChanges, build_subaccount, is_account_sid,
};
use crate::{OperationContext, OperationError};

/// `[[sms.twilio_subaccounts]]`, matched by `sid`. The token is an `${ENV_VAR}` reference or
/// an encrypted secret, never the token itself.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
struct SeedTwilioSubaccount {
    sid: String,
    name: String,
    #[serde(default)]
    status: TwilioAccountStatus,
    /// Left empty (an unset `${ENV_VAR}`), an existing subaccount keeps its token and a new
    /// one gets a generated token.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    auth_token: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    debugger_url: Option<String>,
}

pub struct TwilioSubaccountSeedAdapter;

impl TwilioSubaccountSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_subaccount: SeedTwilioSubaccount = read_seed_table(item_table)?;
        if !is_account_sid(&seed_subaccount.sid) {
            return Err(OperationError::InvalidInput {
                message: "sid must be AC and 32 hex digits".to_owned(),
                field: Some("sid".to_owned()),
            });
        }
        let existing_subaccount = operation_context
            .twilio_subaccount_repository
            .find_subaccount(&seed_subaccount.sid)
            .await?;
        let changes = TwilioSubaccountChanges {
            friendly_name: seed_subaccount.name,
            status: seed_subaccount.status,
            auth_token: Some(seed_subaccount.auth_token),
            debugger_url: seed_subaccount.debugger_url,
        };
        let mut seeded_subaccount = build_subaccount(
            operation_context,
            seed_subaccount.sid.clone(),
            changes,
            existing_subaccount,
        )?;
        seeded_subaccount.created_by = CREATED_BY_SEED.to_owned();
        operation_context
            .twilio_subaccount_repository
            .save_subaccount(seeded_subaccount)
            .await?;
        Ok(seed_subaccount.sid)
    }

    async fn export(
        operation_context: &OperationContext,
        secret_writer: &dyn SetupSecretWriter,
    ) -> Result<Vec<SeedItem>, OperationError> {
        let stored_subaccounts = operation_context
            .twilio_subaccount_repository
            .list_subaccounts()
            .await?;
        stored_subaccounts
            .into_iter()
            .map(|stored_subaccount| {
                let auth_token = secret_writer.write_secret(
                    &format!("twilio_{}_auth_token", stored_subaccount.account_sid),
                    &stored_subaccount.auth_token,
                )?;
                Ok(SeedItem {
                    item_key: stored_subaccount.account_sid.clone(),
                    item_name: stored_subaccount.friendly_name.clone(),
                    table: write_seed_table(&SeedTwilioSubaccount {
                        status: TwilioAccountStatus::parse(&stored_subaccount.status)
                            .unwrap_or_default(),
                        sid: stored_subaccount.account_sid,
                        name: stored_subaccount.friendly_name,
                        auth_token,
                        debugger_url: stored_subaccount.debugger_url,
                    })?,
                })
            })
            .collect()
    }

    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let repository = &operation_context.twilio_subaccount_repository;
        for stored_subaccount in repository.list_subaccounts().await? {
            if !kept_item_keys.contains(&stored_subaccount.account_sid) {
                repository
                    .delete_subaccount(&stored_subaccount.account_sid)
                    .await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(
    TwilioSubaccountSeedAdapter,
    TWILIO_SUBACCOUNTS_SECTION,
    SeedTwilioSubaccount,
    writes_secrets
);
