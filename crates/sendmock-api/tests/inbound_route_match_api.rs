#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use std::collections::BTreeSet;
use std::time::Duration;

use sendmock_ops::run_webhook_rule_subscriber;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use support::webhook_samples::{create_endpoint, create_rule};

const MATCH_PATH: &str = "/api/v1/inbound-routes/match";

async fn create_route(app_router: &axum::Router, route_input: Value) -> String {
    let (status, created) = call_api(
        app_router,
        "POST",
        "/api/v1/inbound-routes",
        Some(&route_input),
    )
    .await;
    assert_eq!(status, 201, "{created}");
    created["id"].as_str().unwrap_or_default().to_owned()
}

/// Three routes (the second calls `stop()`, so the third never runs) and three rules, of
/// which only the first is on `email.inbound` with a filter the reply passes.
async fn create_destinations(app_router: &axum::Router) -> (Vec<String>, String) {
    let ticket_route = create_route(app_router, json!({
        "priority": 1, "description": "Ticket replies",
        "filter": { "kind": "match_recipient", "pattern": "reply\\+(?P<ticket>\\d+)@reply\\.app\\.test" },
        "actions": [{ "kind": "forward_url", "url": "http://localhost:8000/tickets/\\g<ticket>" }],
    }))
    .await;
    let store_route = create_route(
        app_router,
        json!({
            "priority": 2, "description": "Keep everything",
            "filter": { "kind": "catch_all" },
            "actions": [
                { "kind": "store", "notify_url": "http://localhost:8000/stored" },
                { "kind": "stop" },
            ],
        }),
    )
    .await;
    create_route(
        app_router,
        json!({
            "priority": 3, "description": "Never reached",
            "filter": { "kind": "catch_all" },
            "actions": [{ "kind": "forward_url", "url": "http://localhost:8000/late" }],
        }),
    )
    .await;
    let app_endpoint = create_endpoint(app_router, "Local app").await;
    let replies_rule = create_rule(app_router, &json!({
        "name": "Receipt replies", "endpoint_id": app_endpoint, "events": ["email.inbound"],
        "filter": { "all": [{ "field": "subject", "operator": "contains", "value": "receipt" }] },
        "is_enabled": true,
    }))
    .await;
    for (rule_name, events, subject_word) in [
        ("Other replies", json!(["email.inbound"]), "invoice"),
        ("Sent mail", json!(["email.received"]), "receipt"),
    ] {
        create_rule(app_router, &json!({
            "name": rule_name, "endpoint_id": app_endpoint, "events": events,
            "filter": { "all": [{ "field": "subject", "operator": "contains", "value": subject_word }] },
            "is_enabled": true,
        }))
        .await;
    }
    let rule_id = replies_rule["id"].as_str().unwrap_or_default().to_owned();
    (vec![ticket_route, store_route], rule_id)
}

fn incoming_reply() -> Value {
    json!({
        "to": ["Help desk <reply+318@reply.app.test>"],
        "headers": { "subject": "Re: Your receipt", "from": "sam@example.test" },
    })
}

async fn list_deliveries(app_router: &axum::Router, query: &str) -> Vec<Value> {
    let (_, page) = call_api(
        app_router,
        "GET",
        &format!("/api/v1/webhooks/deliveries{query}"),
        None,
    )
    .await;
    page["items"].as_array().cloned().unwrap_or_default()
}

/// Waits up to two seconds for `delivery_count` deliveries of the email.
async fn wait_for_deliveries(
    app_router: &axum::Router,
    email_id: &str,
    delivery_count: usize,
) -> Vec<Value> {
    let mut deliveries = Vec::new();
    for _ in 0..200 {
        deliveries = list_deliveries(app_router, &format!("?subject_id={email_id}")).await;
        if deliveries.len() >= delivery_count {
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    deliveries
}

// AC: EM-22.2
#[tokio::test]
async fn the_match_names_the_routes_in_order_up_to_stop_and_the_inbound_rules_that_pass() {
    let (app_router, _) = build_test_app();
    let (route_ids, rule_id) = create_destinations(&app_router).await;

    let (status, matched) =
        call_api(&app_router, "POST", MATCH_PATH, Some(&incoming_reply())).await;

    assert_eq!(status, 200, "{matched}");
    let matched_route_ids: Vec<&str> = matched["routes"]
        .as_array()
        .map(|routes| {
            routes
                .iter()
                .filter_map(|route| route["route_id"].as_str())
                .collect()
        })
        .unwrap_or_default();
    assert_eq!(matched_route_ids, route_ids);
    assert_eq!(
        matched["routes"][0]["matched_value"],
        "reply+318@reply.app.test"
    );
    assert_eq!(
        matched["routes"][0]["actions"][0]["url"],
        "http://localhost:8000/tickets/318"
    );
    assert_eq!(matched["routes"][0]["calls_stop"], false);
    assert_eq!(matched["routes"][1]["calls_stop"], true);
    assert_eq!(matched["routes"][1]["action_expressions"][1], "stop()");
    let webhook_rules = matched["webhook_rules"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    assert_eq!(webhook_rules.len(), 1, "{matched}");
    assert_eq!(webhook_rules[0]["rule_id"], rule_id.as_str());
    assert_eq!(webhook_rules[0]["endpoint_name"], "Local app");
    assert_eq!(
        webhook_rules[0]["endpoint_url"],
        "http://localhost:3000/hooks"
    );
}

// AC: EM-22.2
#[tokio::test]
async fn the_match_stores_and_sends_nothing() {
    let (app_router, _) = build_test_app();
    create_destinations(&app_router).await;

    call_api(&app_router, "POST", MATCH_PATH, Some(&incoming_reply())).await;
    tokio::time::sleep(Duration::from_millis(100)).await;

    let (_, emails) = call_api(&app_router, "GET", "/api/v1/emails", None).await;
    assert_eq!(
        emails["items"].as_array().map(Vec::len),
        Some(0),
        "{emails}"
    );
    assert!(list_deliveries(&app_router, "").await.is_empty());
}

/// Every URL the match says a route or rule will send to.
fn collect_match_urls(matched: &Value) -> BTreeSet<String> {
    let route_urls = matched["routes"]
        .as_array()
        .into_iter()
        .flatten()
        .flat_map(|route| route["actions"].as_array().cloned().unwrap_or_default())
        .filter_map(|action| {
            action
                .get("url")
                .or_else(|| action.get("notify_url"))
                .and_then(Value::as_str)
                .map(str::to_owned)
        });
    let rule_urls = matched["webhook_rules"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|webhook_rule| webhook_rule["endpoint_url"].as_str().map(str::to_owned));
    route_urls.chain(rule_urls).collect()
}

// AC: EM-22.2 EM-22.5
#[tokio::test]
async fn a_real_incoming_email_then_reaches_exactly_what_the_match_named() {
    let (app_router, operation_context) = build_test_app();
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    create_destinations(&app_router).await;
    let (_, matched) = call_api(&app_router, "POST", MATCH_PATH, Some(&incoming_reply())).await;
    let expected_urls = collect_match_urls(&matched);

    let (status, received) = call_api(
        &app_router,
        "POST",
        "/api/v1/emails/inbound",
        Some(&json!({
            "from": "sam@example.test", "to": ["Help desk <reply+318@reply.app.test>"],
            "subject": "Re: Your receipt", "text": "Thanks",
        })),
    )
    .await;
    assert_eq!(status, 201, "{received}");
    let email_id = received["id"].as_str().unwrap_or_default();
    let deliveries = wait_for_deliveries(&app_router, email_id, expected_urls.len()).await;
    subscriber.abort();

    let delivered_urls: BTreeSet<String> = deliveries
        .iter()
        .filter_map(|delivery| delivery["url"].as_str().map(str::to_owned))
        .collect();
    assert_eq!(expected_urls.len(), 3, "{matched}");
    assert_eq!(delivered_urls, expected_urls, "{deliveries:?}");
    assert!(
        list_deliveries(&app_router, "?subject_id=01JZ0000000000000000000000")
            .await
            .is_empty()
    );
}
