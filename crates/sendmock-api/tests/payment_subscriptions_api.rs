#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const SUBSCRIPTIONS_PATH: &str = "/api/v1/payments/subscriptions";

async fn create_subscription(app_router: &axum::Router, changed_fields: &Value) -> (u16, Value) {
    let mut create_fields = json!({
        "provider": "stripe", "customer_email": "sam@example.test", "plan_name": "Pro",
        "amount_minor": 1500, "currency": "USD", "interval": "month",
    });
    if let (Some(fields), Some(changes)) =
        (create_fields.as_object_mut(), changed_fields.as_object())
    {
        fields.extend(changes.clone());
    }
    call_api(app_router, "POST", SUBSCRIPTIONS_PATH, Some(&create_fields)).await
}

async fn act_on(
    app_router: &axum::Router,
    subscription: &Value,
    action_path: &str,
    body: Option<&Value>,
) -> (u16, Value) {
    let subscription_id = subscription["id"].as_str().unwrap_or_default();
    call_api(
        app_router,
        "POST",
        &format!("{SUBSCRIPTIONS_PATH}/{subscription_id}/{action_path}"),
        body,
    )
    .await
}

async fn read_payment_status(app_router: &axum::Router, payment_id: &Value) -> Value {
    let payment_id = payment_id.as_str().unwrap_or_default();
    call_api(
        app_router,
        "GET",
        &format!("/api/v1/payments/{payment_id}"),
        None,
    )
    .await
    .1["status"]
        .clone()
}

// AC: PY-07.4
#[tokio::test]
async fn a_subscription_charges_at_once_and_renews_when_its_clock_is_advanced() {
    let (app_router, _) = build_test_app();

    let (status, created) = create_subscription(&app_router, &json!({})).await;
    let (_, renewed) = act_on(&app_router, &created, "advance", None).await;
    let (_, listed) = call_api(&app_router, "GET", SUBSCRIPTIONS_PATH, None).await;

    assert_eq!(status, 201, "{created}");
    assert_eq!(created["status"], "active");
    assert_eq!(created["renewal_count"], 1);
    assert_eq!(created["card_last4"], "4242");
    assert_eq!(
        read_payment_status(&app_router, &created["payment_ids"][0]).await,
        "succeeded"
    );
    assert_eq!(renewed["renewal_count"], 2, "{renewed}");
    assert_eq!(
        renewed["current_period_start"],
        created["current_period_end"]
    );
    assert_eq!(renewed["payment_ids"].as_array().map(Vec::len), Some(2));
    assert_eq!(listed[0]["id"], created["id"]);
}

// AC: PY-07.4
#[tokio::test]
async fn a_trial_charges_nothing_until_the_first_advance() {
    let (app_router, _) = build_test_app();

    let (_, trialing) =
        create_subscription(&app_router, &json!({ "trial_days": 7, "interval": "week" })).await;
    let (_, first_paid) = act_on(&app_router, &trialing, "advance", None).await;

    assert_eq!(trialing["status"], "trialing", "{trialing}");
    assert_eq!(trialing["payment_ids"], json!([]));
    assert_eq!(trialing["current_period_end"], trialing["trial_end"]);
    assert_eq!(first_paid["status"], "active");
    assert_eq!(first_paid["trial_end"], Value::Null);
    assert_eq!(first_paid["renewal_count"], 1);
}

// AC: PY-07.4
#[tokio::test]
async fn a_declining_card_leaves_it_past_due_and_a_real_card_is_refused() {
    let (app_router, _) = build_test_app();

    let (_, declined) =
        create_subscription(&app_router, &json!({ "card_number": "4000000000009995" })).await;
    let (refused_status, refused) =
        create_subscription(&app_router, &json!({ "card_number": "4111111111111111" })).await;
    let (unknown_status, _) =
        create_subscription(&app_router, &json!({ "provider": "acme" })).await;

    assert_eq!(declined["status"], "past_due", "{declined}");
    assert_eq!(declined["timeline"][1]["kind"], "payment_failed");
    assert_eq!(
        read_payment_status(&app_router, &declined["payment_ids"][0]).await,
        "failed"
    );
    assert_eq!(refused_status, 422);
    assert_eq!(refused["error"]["code"], "not_a_test_card");
    assert_eq!(unknown_status, 404);
}

// AC: PY-07.4
#[tokio::test]
async fn cancel_at_period_end_ends_it_at_the_next_advance_and_a_canceled_one_stays_canceled() {
    let (app_router, _) = build_test_app();
    let (_, created) = create_subscription(&app_router, &json!({})).await;
    let (_, now_canceled_source) = create_subscription(
        &app_router,
        &json!({ "customer_email": "lee@example.test" }),
    )
    .await;

    let (_, scheduled) = act_on(
        &app_router,
        &created,
        "cancel",
        Some(&json!({ "at_period_end": true })),
    )
    .await;
    let (_, ended) = act_on(&app_router, &created, "advance", None).await;
    let (again_status, _) = act_on(&app_router, &created, "advance", None).await;
    let (_, canceled_now) = act_on(
        &app_router,
        &now_canceled_source,
        "cancel",
        Some(&json!({})),
    )
    .await;

    assert_eq!(scheduled["cancel_at_period_end"], true, "{scheduled}");
    assert_eq!(scheduled["status"], "active");
    assert_eq!(ended["status"], "canceled");
    assert_eq!(ended["canceled_at"], created["current_period_end"]);
    assert_eq!(ended["payment_ids"].as_array().map(Vec::len), Some(1));
    assert_eq!(again_status, 409);
    assert_eq!(canceled_now["status"], "canceled");
}
