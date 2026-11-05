#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::time::Duration;

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

async fn create_checkout(app_router: &axum::Router, provider: &str) -> String {
    let (status, payment) = call_api(
        app_router,
        "POST",
        "/api/v1/payments/checkout",
        Some(&json!({ "provider": provider, "amount_minor": 1999, "currency": "USD" })),
    )
    .await;
    assert_eq!(status, 201, "{payment}");
    payment["id"].as_str().unwrap_or_default().to_owned()
}

async fn wait_for_payment(app_router: &axum::Router, query: &str) -> (u16, Value) {
    call_api(
        app_router,
        "GET",
        &format!("/api/v1/wait/payment?{query}"),
        None,
    )
    .await
}

// AC: PY-11.3
#[tokio::test]
async fn the_wait_returns_once_a_matching_payment_reaches_the_status() {
    let (app_router, _) = build_test_app();
    create_checkout(&app_router, "paypal").await;
    let payment_id = create_checkout(&app_router, "stripe").await;
    let settle_later = async {
        tokio::time::sleep(Duration::from_millis(300)).await;
        call_api(
            &app_router,
            "POST",
            &format!("/api/v1/payments/{payment_id}/simulate"),
            Some(&json!({ "action": "succeed" })),
        )
        .await
    };

    let ((wait_status, waited_payment), (simulate_status, _)) = tokio::join!(
        wait_for_payment(&app_router, "provider=stripe&status=succeeded&timeout=5s"),
        settle_later,
    );

    assert_eq!(simulate_status, 200);
    assert_eq!(wait_status, 200, "{waited_payment}");
    assert_eq!(waited_payment["id"], payment_id.as_str());
    assert_eq!(waited_payment["status"], "succeeded");
    assert!(waited_payment["timeline"].is_array());
}

// AC: PY-11.3
#[tokio::test]
async fn the_wait_times_out_with_408_when_nothing_matches() {
    let (app_router, _) = build_test_app();
    create_checkout(&app_router, "stripe").await;

    let (other_provider_status, other_provider) =
        wait_for_payment(&app_router, "provider=paypal&timeout=1s").await;
    let (other_status_status, _) =
        wait_for_payment(&app_router, "provider=stripe&status=succeeded&timeout=1s").await;
    let (too_new_status, _) = wait_for_payment(
        &app_router,
        "provider=stripe&since=2099-01-01T00:00:00Z&timeout=1s",
    )
    .await;
    let (bad_timeout_status, _) = wait_for_payment(&app_router, "timeout=soon").await;

    assert_eq!(other_provider_status, 408, "{other_provider}");
    assert_eq!(other_status_status, 408);
    assert_eq!(too_new_status, 408);
    assert_eq!(bad_timeout_status, 400);
}
