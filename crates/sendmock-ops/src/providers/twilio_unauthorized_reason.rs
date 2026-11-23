//! Why a Twilio request was refused with 20003, for the request log: Twilio's body never says,
//! so the log is the one place an app's developer can find out.

use crate::twilio_accounts::TwilioAccountDirectory;

/// A wrong token, an unknown account, or a subaccount's token used under another account,
/// from the SID and token the request sent as Basic auth.
pub fn describe_unauthorized_reason(
    directory: &TwilioAccountDirectory,
    path_account_sid: Option<&str>,
    basic_credentials: Option<&(String, String)>,
) -> String {
    let Some((request_account_sid, auth_token)) = basic_credentials else {
        return "No Basic auth: send the account SID and auth token, as Twilio's SDKs do"
            .to_owned();
    };
    let main_account_sid = &directory.main_account.account_sid;
    let Some(known_account) = directory.find_account(request_account_sid) else {
        return format!(
            "Unknown account {}: it is neither the Twilio provider's account SID ({main_account_sid}) nor one of its subaccounts",
            request_account_sid
        );
    };
    let path_account_sid = path_account_sid.unwrap_or(main_account_sid);
    if !known_account.is_main && known_account.account_sid != path_account_sid {
        return format!(
            "The path's account {path_account_sid} is not {}: a subaccount's token works only under its own account",
            known_account.account_sid
        );
    }
    if auth_token.is_empty() || *auth_token != known_account.auth_token {
        return format!("Wrong auth token for {}", known_account.account_sid);
    }
    format!(
        "The token of {} does not open {path_account_sid}",
        known_account.account_sid
    )
}

#[cfg(test)]
mod tests {
    use sendmock_store::TwilioSubaccountRecord;

    use super::*;

    const SHOP_SID: &str = "AC22222222222222222222222222222222";

    fn build_directory() -> TwilioAccountDirectory {
        TwilioAccountDirectory::from_parts(
            None,
            vec![TwilioSubaccountRecord {
                account_sid: SHOP_SID.to_owned(),
                friendly_name: "Shop".to_owned(),
                auth_token: "shop-token".to_owned(),
                status: "active".to_owned(),
                debugger_url: None,
                created_by: "test".to_owned(),
                created_at_unix_ms: 0,
                updated_at_unix_ms: 0,
            }],
        )
    }

    fn describe(path_account_sid: &str, account_sid: &str, auth_token: &str) -> String {
        describe_unauthorized_reason(
            &build_directory(),
            Some(path_account_sid),
            Some(&(account_sid.to_owned(), auth_token.to_owned())),
        )
    }

    // AC: SM-22.4
    #[test]
    fn a_wrong_token_an_unknown_account_and_a_borrowed_path_are_told_apart() {
        assert_eq!(
            describe(SHOP_SID, SHOP_SID, "guess"),
            format!("Wrong auth token for {SHOP_SID}")
        );
        assert!(
            describe(SHOP_SID, "AC99999999999999999999999999999999", "guess")
                .starts_with("Unknown account AC99999999999999999999999999999999")
        );
        assert!(
            describe("ACtest0000000000000000000000000000", SHOP_SID, "shop-token")
                .starts_with("The path's account ACtest0000000000000000000000000000 is not")
        );
        assert!(
            describe_unauthorized_reason(&build_directory(), None, None)
                .starts_with("No Basic auth")
        );
    }
}
