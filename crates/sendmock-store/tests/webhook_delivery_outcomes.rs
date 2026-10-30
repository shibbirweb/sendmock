use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, DeliveryOutcomeFilter, EMBEDDED_MIGRATIONS, StoreError,
    WebhookDeliveryRecord, WebhookDeliveryRepository,
};

fn repository() -> Result<WebhookDeliveryRepository, StoreError> {
    Ok(WebhookDeliveryRepository::new(Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?)))
}

fn finished_delivery(
    delivery_id: &str,
    endpoint_id: &str,
    created_at_unix_ms: i64,
) -> WebhookDeliveryRecord {
    WebhookDeliveryRecord {
        delivery_id: delivery_id.to_owned(),
        endpoint_id: endpoint_id.to_owned(),
        endpoint_name: "Orders app".to_owned(),
        rule_id: None,
        event_id: format!("evt_{delivery_id}"),
        event_type: "email.received".to_owned(),
        event_json: None,
        subject_id: None,
        trigger: "auto".to_owned(),
        attempt: 1,
        status: "succeeded".to_owned(),
        retry_policy_json: "{}".to_owned(),
        rendered_request_json: Some("{}".to_owned()),
        sent_request_json: Some("{}".to_owned()),
        response_json: Some(
            r#"{"status_code":200,"headers":{},"body":"","is_body_truncated":false}"#.to_owned(),
        ),
        duration_ms: Some(40),
        error_message: None,
        next_attempt_at_unix_ms: None,
        created_at_unix_ms,
    }
}

fn listed_ids(outcomes: &[sendmock_store::DeliveryOutcomeRecord]) -> Vec<&str> {
    outcomes
        .iter()
        .map(|outcome| outcome.delivery_id.as_str())
        .collect()
}

// AC: WH-11.2
#[tokio::test]
async fn outcomes_read_the_status_code_timing_and_a_due_retry() -> Result<(), StoreError> {
    let repository = repository()?;
    let mut waiting_retry = finished_delivery("d1", "endpoint-1", 1_000);
    waiting_retry.status = "failed".to_owned();
    waiting_retry.response_json =
        Some(r#"{"status_code":503,"headers":{},"body":"","is_body_truncated":false}"#.to_owned());
    waiting_retry.next_attempt_at_unix_ms = Some(5_000);
    waiting_retry.error_message = Some("Service unavailable".to_owned());
    repository.insert_delivery(waiting_retry).await?;
    let mut unanswered = finished_delivery("d2", "endpoint-1", 2_000);
    unanswered.status = "exhausted".to_owned();
    unanswered.response_json = None;
    repository.insert_delivery(unanswered).await?;

    let outcomes = repository
        .list_delivery_outcomes(DeliveryOutcomeFilter::default())
        .await?;

    assert_eq!(listed_ids(&outcomes), vec!["d1", "d2"]);
    assert_eq!(outcomes[0].response_status_code, Some(503));
    assert!(outcomes[0].has_retry_due);
    assert_eq!(outcomes[0].duration_ms, Some(40));
    assert_eq!(
        outcomes[0].error_message.as_deref(),
        Some("Service unavailable")
    );
    assert_eq!(outcomes[1].response_status_code, None);
    assert!(!outcomes[1].has_retry_due);
    Ok(())
}

// AC: WH-11.2
#[tokio::test]
async fn outcomes_are_oldest_first_from_a_time_and_for_one_endpoint() -> Result<(), StoreError> {
    let repository = repository()?;
    for delivery in [
        finished_delivery("late", "endpoint-1", 3_000),
        finished_delivery("early", "endpoint-1", 1_000),
        finished_delivery("same-time", "endpoint-1", 3_000),
        finished_delivery("other-endpoint", "endpoint-2", 3_000),
    ] {
        repository.insert_delivery(delivery).await?;
    }

    let outcomes = repository
        .list_delivery_outcomes(DeliveryOutcomeFilter {
            created_from_unix_ms: Some(2_000),
            endpoint_id: Some("endpoint-1".to_owned()),
        })
        .await?;

    assert_eq!(listed_ids(&outcomes), vec!["late", "same-time"]);
    Ok(())
}
