#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const FLOWS_PATH: &str = "/api/v1/payments/flows";

fn qr_wallet_flow() -> Value {
    json!({
        "key": "qr_wallet",
        "name": "QR wallet",
        "picker_tab": "Mobile banking",
        "steps": [
            { "type": "qr_code", "title": "Scan to pay", "field_label": "", "hint": "Open {method}.", "button_label": "I have paid" },
            { "type": "pin", "title": "", "field_label": "PIN", "hint": "", "button_label": "Pay {amount}" },
        ],
    })
}

async fn find_flow(app_router: &axum::Router, flow_key: &str) -> Value {
    let (status, payment_flow) =
        call_api(app_router, "GET", &format!("{FLOWS_PATH}/{flow_key}"), None).await;
    assert_eq!(status, 200, "{payment_flow}");
    payment_flow
}

// AC: PY-12.6
#[tokio::test]
async fn lists_the_built_in_flows_with_their_steps_and_method_counts() {
    let (app_router, _) = build_test_app();

    let (status, payment_flows) = call_api(&app_router, "GET", FLOWS_PATH, None).await;

    assert_eq!(status, 200);
    let flow_keys: Vec<&str> = payment_flows
        .as_array()
        .map(|flows| {
            flows
                .iter()
                .filter_map(|flow| flow["key"].as_str())
                .collect()
        })
        .unwrap_or_default();
    assert_eq!(
        flow_keys,
        [
            "card",
            "wallet",
            "bank",
            "account",
            "qr",
            "bank_transfer",
            "voucher"
        ]
    );
    let wallet = &payment_flows[1];
    assert_eq!(wallet["picker_tab"], "Mobile banking");
    assert_eq!(wallet["steps"].as_array().map(Vec::len), Some(3));
    assert_eq!(wallet["is_builtin"], true);
    assert_eq!(wallet["is_modified"], false);
    assert!(wallet["method_count"].as_u64().unwrap_or_default() > 0);
}

// AC: PY-12.6
#[tokio::test]
async fn a_custom_flow_is_created_changed_and_deleted() {
    let (app_router, _) = build_test_app();

    let (create_status, created_flow) =
        call_api(&app_router, "POST", FLOWS_PATH, Some(&qr_wallet_flow())).await;
    let mut renamed_flow = qr_wallet_flow();
    renamed_flow["name"] = json!("QR wallet with PIN");
    let (update_status, updated_flow) = call_api(
        &app_router,
        "PATCH",
        &format!("{FLOWS_PATH}/qr_wallet"),
        Some(&renamed_flow),
    )
    .await;
    let (delete_status, _) = call_api(
        &app_router,
        "DELETE",
        &format!("{FLOWS_PATH}/qr_wallet"),
        None,
    )
    .await;
    let (missing_status, _) =
        call_api(&app_router, "GET", &format!("{FLOWS_PATH}/qr_wallet"), None).await;

    assert_eq!(create_status, 201, "{created_flow}");
    assert_eq!(created_flow["is_builtin"], false);
    assert_eq!(created_flow["method_count"], 0);
    assert_eq!(update_status, 200, "{updated_flow}");
    assert_eq!(updated_flow["name"], "QR wallet with PIN");
    assert_eq!(delete_status, 204);
    assert_eq!(missing_status, 404);
}

// AC: PY-12.6
#[tokio::test]
async fn an_edited_built_in_shows_modified_until_it_is_reset_and_cannot_be_deleted() {
    let (app_router, _) = build_test_app();
    let mut wallet = find_flow(&app_router, "wallet").await;
    wallet["name"] = json!("Mobile wallet");

    call_api(
        &app_router,
        "PATCH",
        &format!("{FLOWS_PATH}/wallet"),
        Some(&wallet),
    )
    .await;
    let edited_wallet = find_flow(&app_router, "wallet").await;
    let (delete_status, delete_answer) =
        call_api(&app_router, "DELETE", &format!("{FLOWS_PATH}/wallet"), None).await;
    let (reset_status, reset_wallet) = call_api(
        &app_router,
        "POST",
        &format!("{FLOWS_PATH}/wallet/reset"),
        None,
    )
    .await;
    let (custom_reset_status, _) = {
        call_api(&app_router, "POST", FLOWS_PATH, Some(&qr_wallet_flow())).await;
        call_api(
            &app_router,
            "POST",
            &format!("{FLOWS_PATH}/qr_wallet/reset"),
            None,
        )
        .await
    };

    assert_eq!(edited_wallet["is_modified"], true);
    assert_eq!(edited_wallet["name"], "Mobile wallet");
    assert_eq!(delete_status, 409);
    assert_eq!(delete_answer["error"]["code"], "builtin_flow");
    assert_eq!(reset_status, 200);
    assert_eq!(reset_wallet["name"], "Wallet");
    assert_eq!(reset_wallet["is_modified"], false);
    assert_eq!(custom_reset_status, 409);
}

// AC: PY-12.5
// AC: PY-12.6
#[tokio::test]
async fn steps_are_added_moved_relabelled_and_removed_one_at_a_time() {
    let (app_router, _) = build_test_app();
    call_api(&app_router, "POST", FLOWS_PATH, Some(&qr_wallet_flow())).await;
    let steps_path = format!("{FLOWS_PATH}/qr_wallet/steps");

    let (add_status, with_otp) = call_api(
        &app_router,
        "POST",
        &steps_path,
        Some(&json!({ "step": { "type": "otp" }, "position": 1 })),
    )
    .await;
    let (move_status, moved) = call_api(
        &app_router,
        "PATCH",
        &format!("{steps_path}/2"),
        Some(&json!({ "position": 0, "button_label": "Confirm PIN" })),
    )
    .await;
    let (remove_status, removed) =
        call_api(&app_router, "DELETE", &format!("{steps_path}/1"), None).await;
    let (missing_status, _) =
        call_api(&app_router, "DELETE", &format!("{steps_path}/9"), None).await;

    let step_types = |flow: &Value| -> Vec<String> {
        flow["steps"]
            .as_array()
            .map(|steps| {
                steps
                    .iter()
                    .filter_map(|step| step["type"].as_str())
                    .map(str::to_owned)
                    .collect()
            })
            .unwrap_or_default()
    };
    assert_eq!(add_status, 200, "{with_otp}");
    assert_eq!(step_types(&with_otp), ["qr_code", "otp", "pin"]);
    assert_eq!(with_otp["steps"][1]["field_label"], "Verification code");
    assert_eq!(move_status, 200, "{moved}");
    assert_eq!(step_types(&moved), ["pin", "qr_code", "otp"]);
    assert_eq!(moved["steps"][0]["button_label"], "Confirm PIN");
    assert_eq!(remove_status, 200);
    assert_eq!(step_types(&removed), ["pin", "otp"]);
    assert_eq!(missing_status, 404);
}

// AC: PY-12.6
// AC: PY-12.7
#[tokio::test]
async fn a_flow_that_breaks_the_rules_is_refused_with_the_reason() {
    let (app_router, _) = build_test_app();
    let mut two_deciding_steps = qr_wallet_flow();
    two_deciding_steps["steps"] = json!([
        { "type": "card_form", "title": "", "field_label": "Card", "hint": "", "button_label": "Pay" },
        { "type": "account_number", "title": "", "field_label": "Number", "hint": "", "button_label": "Pay" },
    ]);
    let mut unknown_variable = qr_wallet_flow();
    unknown_variable["steps"][1]["hint"] = json!("Your {methd} PIN");

    let (deciding_status, deciding_answer) =
        call_api(&app_router, "POST", FLOWS_PATH, Some(&two_deciding_steps)).await;
    let (variable_status, variable_answer) =
        call_api(&app_router, "POST", FLOWS_PATH, Some(&unknown_variable)).await;
    let (too_many_status, _) = call_api(
        &app_router,
        "POST",
        &format!("{FLOWS_PATH}/card/steps"),
        Some(&json!({ "step": { "type": "voucher_code" } })),
    )
    .await;

    assert_eq!(deciding_status, 400);
    assert!(
        deciding_answer["error"]["message"]
            .as_str()
            .is_some_and(|message| message.starts_with("Use one deciding step"))
    );
    assert_eq!(variable_status, 400);
    assert_eq!(variable_answer["error"]["field"], "steps.1");
    assert!(
        variable_answer["error"]["message"]
            .as_str()
            .is_some_and(|message| message.starts_with("{methd} is not a variable"))
    );
    assert_eq!(too_many_status, 400);
}

// AC: PY-12.7
#[tokio::test]
async fn the_step_catalogue_and_label_variables_are_served() {
    let (app_router, _) = build_test_app();

    let (_, step_types) = call_api(&app_router, "GET", "/api/v1/payments/step-types", None).await;
    let (_, flow_variables) =
        call_api(&app_router, "GET", "/api/v1/payments/flow-variables", None).await;

    assert_eq!(step_types.as_array().map(Vec::len), Some(9));
    assert_eq!(step_types[0]["type"], "card_form");
    assert_eq!(step_types[0]["is_deciding"], true);
    assert_eq!(flow_variables[0]["token"], "{method}");
    assert_eq!(flow_variables[0]["example"], "bKash");
    assert_eq!(flow_variables.as_array().map(Vec::len), Some(7));
}
