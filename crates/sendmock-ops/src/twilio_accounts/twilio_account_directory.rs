use sendmock_store::TwilioSubaccountRecord;

use super::twilio_subaccount_inputs::TwilioAccountStatus;
use crate::providers::{MessageProviderDefinition, SMS_PROVIDER_AREA, find_area_provider};
use crate::{OperationContext, OperationError};

/// The Twilio provider's key; its credentials are the main account.
pub const TWILIO_PROVIDER_KEY: &str = "twilio";
const DEFAULT_MAIN_ACCOUNT_SID: &str = "ACtest00000000000000000000000000";

/// One Twilio account, main or sub, with what signing and the Accounts API need.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TwilioAccount {
    pub account_sid: String,
    pub friendly_name: String,
    pub auth_token: String,
    pub status: TwilioAccountStatus,
    pub debugger_url: Option<String>,
    /// The main account's SID, for the main account too, as Twilio answers it.
    pub owner_account_sid: String,
    pub is_main: bool,
    pub created_at_unix_ms: i64,
    pub updated_at_unix_ms: i64,
}

impl TwilioAccount {
    pub fn from_subaccount(
        stored_subaccount: TwilioSubaccountRecord,
        owner_account_sid: &str,
    ) -> Self {
        Self {
            status: TwilioAccountStatus::parse(&stored_subaccount.status).unwrap_or_default(),
            account_sid: stored_subaccount.account_sid,
            friendly_name: stored_subaccount.friendly_name,
            auth_token: stored_subaccount.auth_token,
            debugger_url: stored_subaccount.debugger_url,
            owner_account_sid: owner_account_sid.to_owned(),
            is_main: false,
            created_at_unix_ms: stored_subaccount.created_at_unix_ms,
            updated_at_unix_ms: stored_subaccount.updated_at_unix_ms,
        }
    }
}

/// The main account (the Twilio provider's credentials) and its subaccounts.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TwilioAccountDirectory {
    pub main_account: TwilioAccount,
    pub subaccounts: Vec<TwilioAccount>,
}

impl TwilioAccountDirectory {
    pub async fn load(operation_context: &OperationContext) -> Result<Self, OperationError> {
        let twilio_provider =
            find_area_provider(operation_context, SMS_PROVIDER_AREA, TWILIO_PROVIDER_KEY)
                .await
                .ok();
        let stored_subaccounts = operation_context
            .twilio_subaccount_repository
            .list_subaccounts()
            .await?;
        Ok(Self::from_parts(
            twilio_provider.as_ref(),
            stored_subaccounts,
        ))
    }

    pub fn from_parts(
        twilio_provider: Option<&MessageProviderDefinition>,
        stored_subaccounts: Vec<TwilioSubaccountRecord>,
    ) -> Self {
        let read_credential = |credential_name: &str| {
            twilio_provider
                .and_then(|provider| provider.find_credential(credential_name))
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_owned)
        };
        let main_account_sid =
            read_credential("account_sid").unwrap_or_else(|| DEFAULT_MAIN_ACCOUNT_SID.to_owned());
        let main_account = TwilioAccount {
            account_sid: main_account_sid.clone(),
            friendly_name: "Main account".to_owned(),
            auth_token: read_credential("auth_token").unwrap_or_default(),
            status: TwilioAccountStatus::Active,
            debugger_url: read_credential("debugger_url"),
            owner_account_sid: main_account_sid.clone(),
            is_main: true,
            created_at_unix_ms: 0,
            updated_at_unix_ms: 0,
        };
        let subaccounts = stored_subaccounts
            .into_iter()
            .map(|stored_subaccount| {
                TwilioAccount::from_subaccount(stored_subaccount, &main_account_sid)
            })
            .collect();
        Self {
            main_account,
            subaccounts,
        }
    }

    /// The main account first, then the subaccounts, oldest first.
    pub fn all_accounts(&self) -> impl Iterator<Item = &TwilioAccount> {
        std::iter::once(&self.main_account).chain(self.subaccounts.iter())
    }

    pub fn find_account(&self, account_sid: &str) -> Option<&TwilioAccount> {
        self.all_accounts()
            .find(|account| account.account_sid == account_sid)
    }

    /// The account a message or event belongs to: a known subaccount, or else the main
    /// account, so setups made before subaccounts keep signing with the main token.
    pub fn account_for(&self, account_sid: Option<&str>) -> &TwilioAccount {
        account_sid
            .and_then(|account_sid| {
                self.subaccounts
                    .iter()
                    .find(|subaccount| subaccount.account_sid == account_sid)
            })
            .unwrap_or(&self.main_account)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::ProviderCredential;

    fn twilio_provider() -> MessageProviderDefinition {
        MessageProviderDefinition {
            key: TWILIO_PROVIDER_KEY.to_owned(),
            credentials: vec![
                ProviderCredential {
                    name: "account_sid".to_owned(),
                    value: "ACmain".to_owned(),
                    is_secret: false,
                },
                ProviderCredential {
                    name: "auth_token".to_owned(),
                    value: "main-token".to_owned(),
                    is_secret: true,
                },
            ],
            ..MessageProviderDefinition::default()
        }
    }

    fn subaccount(account_sid: &str, auth_token: &str) -> TwilioSubaccountRecord {
        TwilioSubaccountRecord {
            account_sid: account_sid.to_owned(),
            friendly_name: "Customer".to_owned(),
            auth_token: auth_token.to_owned(),
            status: "active".to_owned(),
            debugger_url: None,
            created_by: "ui".to_owned(),
            created_at_unix_ms: 1,
            updated_at_unix_ms: 1,
        }
    }

    // AC: SM-19.5
    #[test]
    fn a_subaccount_signs_with_its_own_token_and_anything_else_with_the_main_token() {
        let directory = TwilioAccountDirectory::from_parts(
            Some(&twilio_provider()),
            vec![subaccount("ACsub", "sub-token")],
        );

        assert_eq!(directory.account_for(Some("ACsub")).auth_token, "sub-token");
        assert_eq!(
            directory.account_for(Some("ACunknown")).auth_token,
            "main-token"
        );
        assert_eq!(directory.account_for(None).auth_token, "main-token");
        assert_eq!(
            directory.account_for(Some("ACsub")).owner_account_sid,
            "ACmain"
        );
    }

    #[test]
    fn without_a_twilio_provider_the_main_account_is_the_shipped_test_sid() {
        let directory = TwilioAccountDirectory::from_parts(None, Vec::new());

        assert_eq!(directory.main_account.account_sid, DEFAULT_MAIN_ACCOUNT_SID);
        assert!(directory.main_account.is_main);
    }
}
