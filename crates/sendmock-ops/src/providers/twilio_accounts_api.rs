use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use sendmock_core::format_rfc5322;
use serde_json::{Value, json};

use super::message_provider_definition::MessageProviderDefinition;
use super::provider_http::{ProviderHttpRequest, ProviderHttpResponse};
use super::request_reader::read_request_fields;
use super::twilio_answers::{answer_json, answer_twilio_error, read_form_field};
use crate::twilio_accounts::{
    TwilioAccount, TwilioAccountDirectory, TwilioAccountStatus, TwilioSubaccountChanges,
    build_subaccount, generate_account_sid,
};
use crate::{OperationContext, OperationError};

const ACCOUNTS_LIST_PATH: &str = "/2010-04-01/Accounts.json";
const ACCOUNT_PATH_PREFIX: &str = "/2010-04-01/Accounts/";
const SUBRESOURCE_NAMES: [&str; 8] = [
    "messages",
    "incoming_phone_numbers",
    "notifications",
    "calls",
    "queues",
    "recordings",
    "usage",
    "balance",
];

/// A Twilio Accounts API answer, with every token that must be masked in the request log.
pub struct TwilioAccountsAnswer {
    pub response: ProviderHttpResponse,
    pub secret_values: Vec<String>,
}

/// Who called: the main account sees every account, a subaccount only itself.
enum Caller<'directory> {
    Main,
    Subaccount(&'directory TwilioAccount),
}

/// Twilio's Accounts API (`/2010-04-01/Accounts.json` and `/Accounts/{AccountSid}.json`):
/// list, create, fetch and update. These answer auth tokens, so they always check
/// credentials, even when Check credentials is off. `None` for other paths.
pub async fn answer_twilio_accounts_request(
    operation_context: &OperationContext,
    twilio_provider: &MessageProviderDefinition,
    request: &ProviderHttpRequest,
) -> Result<Option<TwilioAccountsAnswer>, OperationError> {
    let Some(account_target) = read_account_target(&request.path) else {
        return Ok(None);
    };
    let stored_subaccounts = operation_context
        .twilio_subaccount_repository
        .list_subaccounts()
        .await?;
    let directory = TwilioAccountDirectory::from_parts(Some(twilio_provider), stored_subaccounts);
    let secret_values = directory
        .all_accounts()
        .map(|account| account.auth_token.clone())
        .filter(|auth_token| !auth_token.is_empty())
        .collect();
    let Some(caller) = identify_caller(&directory, request) else {
        return Ok(Some(TwilioAccountsAnswer {
            response: answer_twilio_error(401, 20003, "Authenticate"),
            secret_values,
        }));
    };
    let fields = read_request_fields(request, "form").unwrap_or_default();
    let response = match (request.method.as_str(), account_target) {
        ("GET", None) => answer_account_list(&directory, &caller, &fields),
        ("POST", None) => {
            create_subaccount(operation_context, &directory, &caller, &fields).await?
        }
        ("GET", Some(account_sid)) => match find_visible(&directory, &caller, account_sid) {
            Some(account) => answer_json(200, describe_account(account)),
            None => answer_account_not_found(&request.path),
        },
        ("POST", Some(account_sid)) => {
            update_account(operation_context, &directory, &caller, account_sid, &fields).await?
        }
        _ => return Ok(None),
    };
    Ok(Some(TwilioAccountsAnswer {
        response,
        secret_values,
    }))
}

/// `Some(None)` for the list path, `Some(Some(sid))` for one account, `None` otherwise.
fn read_account_target(request_path: &str) -> Option<Option<&str>> {
    if request_path == ACCOUNTS_LIST_PATH {
        return Some(None);
    }
    let account_sid = request_path
        .strip_prefix(ACCOUNT_PATH_PREFIX)?
        .strip_suffix(".json")?;
    let is_one_segment = !account_sid.is_empty() && !account_sid.contains('/');
    is_one_segment.then_some(Some(account_sid))
}

fn identify_caller<'directory>(
    directory: &'directory TwilioAccountDirectory,
    request: &ProviderHttpRequest,
) -> Option<Caller<'directory>> {
    let (user_name, password) = request
        .header("authorization")
        .and_then(|authorization| authorization.strip_prefix("Basic "))
        .and_then(|encoded| STANDARD.decode(encoded.trim()).ok())
        .and_then(|decoded| String::from_utf8(decoded).ok())
        .and_then(|credentials| {
            credentials
                .split_once(':')
                .map(|(user_name, password)| (user_name.to_owned(), password.to_owned()))
        })?;
    let main_account = &directory.main_account;
    if user_name == main_account.account_sid && password == main_account.auth_token {
        return Some(Caller::Main);
    }
    directory
        .subaccounts
        .iter()
        .find(|subaccount| subaccount.account_sid == user_name && subaccount.auth_token == password)
        .map(Caller::Subaccount)
}

fn find_visible<'directory>(
    directory: &'directory TwilioAccountDirectory,
    caller: &Caller<'_>,
    account_sid: &str,
) -> Option<&'directory TwilioAccount> {
    let account = directory.find_account(account_sid)?;
    match caller {
        Caller::Main => Some(account),
        Caller::Subaccount(subaccount) => {
            (subaccount.account_sid == account.account_sid).then_some(account)
        }
    }
}

fn answer_account_list(
    directory: &TwilioAccountDirectory,
    caller: &Caller<'_>,
    fields: &Value,
) -> ProviderHttpResponse {
    let friendly_name_filter = read_form_field(fields, "FriendlyName");
    let status_filter = read_form_field(fields, "Status").map(|status| status.to_lowercase());
    let accounts: Vec<Value> = directory
        .all_accounts()
        .filter(|account| match caller {
            Caller::Main => true,
            Caller::Subaccount(subaccount) => subaccount.account_sid == account.account_sid,
        })
        .filter(|account| {
            friendly_name_filter
                .as_deref()
                .is_none_or(|friendly_name| account.friendly_name == friendly_name)
        })
        .filter(|account| {
            status_filter
                .as_deref()
                .is_none_or(|status| account.status.as_str() == status)
        })
        .map(describe_account)
        .collect();
    let page_uri = format!("{ACCOUNTS_LIST_PATH}?PageSize=50&Page=0");
    answer_json(
        200,
        json!({
            "accounts": accounts,
            "end": accounts.len().saturating_sub(1),
            "first_page_uri": page_uri,
            "next_page_uri": Value::Null,
            "page": 0,
            "page_size": 50,
            "previous_page_uri": Value::Null,
            "start": 0,
            "uri": page_uri,
        }),
    )
}

async fn create_subaccount(
    operation_context: &OperationContext,
    directory: &TwilioAccountDirectory,
    caller: &Caller<'_>,
    fields: &Value,
) -> Result<ProviderHttpResponse, OperationError> {
    if !matches!(caller, Caller::Main) {
        return Ok(answer_twilio_error(401, 20003, "Authenticate"));
    }
    let account_sid = generate_account_sid(operation_context);
    let friendly_name = read_form_field(fields, "FriendlyName").unwrap_or_else(|| {
        format!(
            "SubAccount Created at {}",
            format_rfc5322(operation_context.clock.now_unix_ms())
        )
    });
    let changes = TwilioSubaccountChanges {
        friendly_name,
        status: TwilioAccountStatus::Active,
        auth_token: None,
        debugger_url: None,
    };
    let new_subaccount = build_subaccount(operation_context, account_sid, changes, None)?;
    operation_context
        .twilio_subaccount_repository
        .save_subaccount(new_subaccount.clone())
        .await?;
    let created_account =
        TwilioAccount::from_subaccount(new_subaccount, &directory.main_account.account_sid);
    Ok(answer_json(201, describe_account(&created_account)))
}

async fn update_account(
    operation_context: &OperationContext,
    directory: &TwilioAccountDirectory,
    caller: &Caller<'_>,
    account_sid: &str,
    fields: &Value,
) -> Result<ProviderHttpResponse, OperationError> {
    let Some(account) = find_visible(directory, caller, account_sid) else {
        return Ok(answer_account_not_found(&format!(
            "{ACCOUNT_PATH_PREFIX}{account_sid}.json"
        )));
    };
    let requested_status = read_form_field(fields, "Status");
    let status = match requested_status.as_deref().map(TwilioAccountStatus::parse) {
        None => account.status,
        Some(Some(status)) => status,
        Some(None) => {
            return Ok(answer_twilio_error(
                400,
                20001,
                "Status must be one of active, suspended or closed",
            ));
        }
    };
    if account.is_main {
        return Ok(answer_json(200, describe_account(account)));
    }
    let changes = TwilioSubaccountChanges {
        friendly_name: read_form_field(fields, "FriendlyName")
            .unwrap_or_else(|| account.friendly_name.clone()),
        status,
        auth_token: None,
        debugger_url: account.debugger_url.clone(),
    };
    let existing_subaccount = operation_context
        .twilio_subaccount_repository
        .find_subaccount(account_sid)
        .await?;
    let changed_subaccount = build_subaccount(
        operation_context,
        account_sid.to_owned(),
        changes,
        existing_subaccount,
    )?;
    operation_context
        .twilio_subaccount_repository
        .save_subaccount(changed_subaccount.clone())
        .await?;
    let changed_account =
        TwilioAccount::from_subaccount(changed_subaccount, &directory.main_account.account_sid);
    Ok(answer_json(200, describe_account(&changed_account)))
}

/// Twilio's Account resource.
fn describe_account(account: &TwilioAccount) -> Value {
    let account_uri = format!("{ACCOUNT_PATH_PREFIX}{}", account.account_sid);
    let subresource_uris: serde_json::Map<String, Value> = SUBRESOURCE_NAMES
        .iter()
        .map(|subresource_name| {
            let file_name = match *subresource_name {
                "incoming_phone_numbers" => "IncomingPhoneNumbers",
                "messages" => "Messages",
                "notifications" => "Notifications",
                "calls" => "Calls",
                "queues" => "Queues",
                "recordings" => "Recordings",
                "usage" => "Usage",
                _ => "Balance",
            };
            (
                (*subresource_name).to_owned(),
                Value::from(format!("{account_uri}/{file_name}.json")),
            )
        })
        .collect();
    json!({
        "auth_token": account.auth_token,
        "date_created": format_rfc5322(account.created_at_unix_ms),
        "date_updated": format_rfc5322(account.updated_at_unix_ms),
        "friendly_name": account.friendly_name,
        "owner_account_sid": account.owner_account_sid,
        "sid": account.account_sid,
        "status": account.status.as_str(),
        "subresource_uris": subresource_uris,
        "type": "Full",
        "uri": format!("{account_uri}.json"),
    })
}

fn answer_account_not_found(request_path: &str) -> ProviderHttpResponse {
    answer_twilio_error(
        404,
        20404,
        &format!("The requested resource {request_path} was not found"),
    )
}
