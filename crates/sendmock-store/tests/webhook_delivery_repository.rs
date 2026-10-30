use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, DeliveryAttemptResult, EMBEDDED_MIGRATIONS, StoreError,
    WebhookDeliveryFilter, WebhookDeliveryRecord, WebhookDeliveryRepository,
};

fn repository() -> Result<WebhookDeliveryRepository, StoreError> {
    Ok(WebhookDeliveryRepository::new(Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?)))
}

fn pending_delivery(delivery_id: &str, due_at_unix_ms: i64) -> WebhookDeliveryRecord {
    WebhookDeliveryRecord {
        delivery_id: delivery_id.to_owned(),
        endpoint_id: "endpoint-1".to_owned(),
        endpoint_name: "Orders app".to_owned(),
        rule_id: None,
        event_id: format!("evt_{delivery_id}"),
        event_type: "email.received".to_owned(),
        event_json: Some(r#"{"type":"email.received"}"#.to_owned()),
        subject_id: None,
        trigger: "auto".to_owned(),
        attempt: 1,
        status: "pending".to_owned(),
        retry_policy_json: "{}".to_owned(),
        rendered_request_json: Some("{}".to_owned()),
        sent_request_json: None,
        response_json: None,
        duration_ms: None,
        error_message: None,
        next_attempt_at_unix_ms: Some(due_at_unix_ms),
        created_at_unix_ms: due_at_unix_ms,
    }
}

fn failed_result(retry_at_unix_ms: Option<i64>) -> DeliveryAttemptResult {
    DeliveryAttemptResult {
        status: "failed".to_owned(),
        sent_request_json: Some("{}".to_owned()),
        response_json: None,
        duration_ms: Some(12),
        error_message: Some("Connection refused".to_owned()),
        next_attempt_at_unix_ms: retry_at_unix_ms,
    }
}

async fn due_ids(
    repository: &WebhookDeliveryRepository,
    now_unix_ms: i64,
) -> Result<Vec<String>, StoreError> {
    Ok(repository
        .list_due_deliveries(now_unix_ms, 10)
        .await?
        .into_iter()
        .map(|delivery| delivery.delivery_id)
        .collect())
}

#[tokio::test]
async fn only_rows_whose_time_has_come_are_due() -> Result<(), StoreError> {
    let repository = repository()?;
    repository
        .insert_delivery(pending_delivery("a", 1_000))
        .await?;
    repository
        .insert_delivery(pending_delivery("b", 5_000))
        .await?;

    assert_eq!(due_ids(&repository, 2_000).await?, vec!["a".to_owned()]);
    assert_eq!(repository.find_next_due_time().await?, Some(1_000));
    Ok(())
}

#[tokio::test]
async fn a_stored_delivery_reads_back_with_its_event() -> Result<(), StoreError> {
    let repository = repository()?;
    let queued_delivery = pending_delivery("a", 1_000);
    repository.insert_delivery(queued_delivery.clone()).await?;

    let stored_delivery = repository.find_delivery("a").await?;

    assert_eq!(stored_delivery, Some(queued_delivery));
    Ok(())
}

#[tokio::test]
async fn a_pending_row_is_claimed_once() -> Result<(), StoreError> {
    let repository = repository()?;
    repository
        .insert_delivery(pending_delivery("a", 1_000))
        .await?;

    assert!(repository.start_pending_attempt("a").await?);
    assert!(!repository.start_pending_attempt("a").await?);
    assert!(due_ids(&repository, 2_000).await?.is_empty());
    Ok(())
}

// AC: WH-04.2
#[tokio::test]
async fn a_retry_adds_the_next_attempt_with_the_same_event_id() -> Result<(), StoreError> {
    let repository = repository()?;
    repository
        .insert_delivery(pending_delivery("a", 1_000))
        .await?;
    repository.start_pending_attempt("a").await?;
    repository
        .finish_attempt("a", failed_result(Some(3_000)))
        .await?;

    let retry_row = WebhookDeliveryRecord {
        delivery_id: "b".to_owned(),
        attempt: 2,
        status: "in_flight".to_owned(),
        next_attempt_at_unix_ms: None,
        ..pending_delivery("a", 3_000)
    };
    let was_claimed = repository
        .start_retry_attempt("a", retry_row.clone())
        .await?;
    let was_claimed_twice = repository.start_retry_attempt("a", retry_row).await?;
    let attempts = repository
        .list_event_attempts("evt_a", "endpoint-1")
        .await?;

    assert!(was_claimed);
    assert!(!was_claimed_twice);
    assert_eq!(
        attempts
            .iter()
            .map(|attempt| (
                attempt.attempt,
                attempt.status.as_str(),
                attempt.next_attempt_at_unix_ms
            ))
            .collect::<Vec<_>>(),
        vec![(1, "failed", None), (2, "in_flight", None)]
    );
    Ok(())
}

// AC: WH-03.4
#[tokio::test]
async fn a_cancelled_retry_never_comes_due() -> Result<(), StoreError> {
    let repository = repository()?;
    repository
        .insert_delivery(pending_delivery("a", 1_000))
        .await?;
    repository.start_pending_attempt("a").await?;
    repository
        .finish_attempt("a", failed_result(Some(3_000)))
        .await?;

    assert!(repository.cancel_delivery("a").await?);
    assert!(!repository.cancel_delivery("a").await?);
    assert!(due_ids(&repository, 10_000).await?.is_empty());
    assert_eq!(
        repository
            .find_delivery("a")
            .await?
            .map(|delivery| delivery.status),
        Some("cancelled".to_owned())
    );
    Ok(())
}

#[tokio::test]
async fn a_final_failure_cannot_be_cancelled() -> Result<(), StoreError> {
    let repository = repository()?;
    repository
        .insert_delivery(pending_delivery("a", 1_000))
        .await?;
    repository.start_pending_attempt("a").await?;
    repository.finish_attempt("a", failed_result(None)).await?;

    assert!(!repository.cancel_delivery("a").await?);
    Ok(())
}

// AC: WH-03.3
#[tokio::test]
async fn rows_left_in_flight_are_queued_again() -> Result<(), StoreError> {
    let repository = repository()?;
    repository
        .insert_delivery(pending_delivery("a", 1_000))
        .await?;
    repository.start_pending_attempt("a").await?;

    let requeued_count = repository.requeue_in_flight(7_000).await?;

    assert_eq!(requeued_count, 1);
    assert_eq!(due_ids(&repository, 7_000).await?, vec!["a".to_owned()]);
    Ok(())
}

#[tokio::test]
async fn the_list_filters_by_status_and_pages_newest_first() -> Result<(), StoreError> {
    let repository = repository()?;
    for delivery_id in ["01A", "01B", "01C"] {
        repository
            .insert_delivery(pending_delivery(delivery_id, 1_000))
            .await?;
    }
    repository.start_pending_attempt("01B").await?;
    repository
        .finish_attempt("01B", failed_result(None))
        .await?;

    let first_page = repository
        .list_deliveries(WebhookDeliveryFilter::default(), None, 2)
        .await?;
    let failed_page = repository
        .list_deliveries(
            WebhookDeliveryFilter {
                statuses: vec!["failed".to_owned(), "exhausted".to_owned()],
                ..WebhookDeliveryFilter::default()
            },
            None,
            50,
        )
        .await?;

    assert_eq!(
        first_page
            .deliveries
            .iter()
            .map(|delivery| delivery.delivery_id.as_str())
            .collect::<Vec<_>>(),
        vec!["01C", "01B"]
    );
    assert_eq!(first_page.next_cursor, Some("01B".to_owned()));
    assert_eq!(first_page.total_count, 3);
    assert_eq!(failed_page.total_count, 1);
    Ok(())
}
