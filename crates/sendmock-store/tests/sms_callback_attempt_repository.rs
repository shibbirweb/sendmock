use std::sync::Arc;

use sendmock_store::{
    CallbackAttemptResult, Database, DatabaseLocation, EMBEDDED_MIGRATIONS, NewSmsRecord,
    SmsCallbackAttemptRecord, SmsCallbackAttemptRepository, SmsRecord, SmsRepository, StoreError,
};

async fn repository_with_message() -> Result<SmsCallbackAttemptRepository, StoreError> {
    let database = Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?);
    SmsRepository::new(Arc::clone(&database))
        .insert_message(NewSmsRecord {
            sms: outbound_sms(),
            media_contents: Vec::new(),
        })
        .await?;
    Ok(SmsCallbackAttemptRepository::new(database))
}

fn outbound_sms() -> SmsRecord {
    SmsRecord {
        sms_id: "01SMS".to_owned(),
        provider_id: "SM01".to_owned(),
        direction: "outbound".to_owned(),
        channel: "sms".to_owned(),
        api: "twilio".to_owned(),
        from_number: "+15550001111".to_owned(),
        from_raw: "+15550001111".to_owned(),
        to_number: "+8801700000000".to_owned(),
        to_raw: "+8801700000000".to_owned(),
        thread_id: "sms-15550001111-8801700000000".to_owned(),
        app_number: "+15550001111".to_owned(),
        contact_number: "+8801700000000".to_owned(),
        body: "Hi".to_owned(),
        encoding: "GSM-7".to_owned(),
        segments: 1,
        status: "queued".to_owned(),
        error_code: None,
        status_callback_url: Some("http://127.0.0.1:9/status".to_owned()),
        messaging_service_sid: None,
        account: None,
        otp_codes: Vec::new(),
        links: Vec::new(),
        metadata_json: None,
        request_body_json: None,
        api_request_id: None,
        opened_at_unix_ms: None,
        open_count: 0,
        is_read: false,
        in_reply_to_sms_id: None,
        created_at_unix_ms: 1_000,
        updated_at_unix_ms: 1_000,
        media: Vec::new(),
    }
}

fn attempt(
    attempt_id: &str,
    status: &str,
    next_attempt_at_unix_ms: Option<i64>,
) -> SmsCallbackAttemptRecord {
    SmsCallbackAttemptRecord {
        attempt_id: attempt_id.to_owned(),
        sms_id: "01SMS".to_owned(),
        reported_status: "sent".to_owned(),
        attempt: 1,
        status: status.to_owned(),
        request_json: "{}".to_owned(),
        response_json: None,
        duration_ms: None,
        error_message: None,
        next_attempt_at_unix_ms,
        created_at_unix_ms: 1_000,
    }
}

fn failed_with_retry_at(next_attempt_at_unix_ms: i64) -> CallbackAttemptResult {
    CallbackAttemptResult {
        status: "failed".to_owned(),
        response_json: None,
        duration_ms: Some(3),
        error_message: Some("Your handler answered 503".to_owned()),
        next_attempt_at_unix_ms: Some(next_attempt_at_unix_ms),
    }
}

#[tokio::test]
async fn a_failed_attempt_comes_due_at_its_retry_time() -> Result<(), StoreError> {
    let repository = repository_with_message().await?;
    repository
        .insert_attempt(attempt("01A", "in_flight", None))
        .await?;

    let was_finished = repository
        .finish_attempt("01A", failed_with_retry_at(2_000))
        .await?;

    assert!(was_finished);
    assert!(repository.list_due_attempts(1_999, 10).await?.is_empty());
    assert_eq!(repository.find_next_due_time().await?, Some(2_000));
    let due_attempts = repository.list_due_attempts(2_000, 10).await?;
    assert_eq!(due_attempts.len(), 1);
    assert_eq!(due_attempts[0].status, "failed");
    Ok(())
}

#[tokio::test]
async fn a_retry_is_claimed_once_and_adds_the_next_attempt() -> Result<(), StoreError> {
    let repository = repository_with_message().await?;
    repository
        .insert_attempt(attempt("01A", "failed", Some(2_000)))
        .await?;
    let retry_attempt = SmsCallbackAttemptRecord {
        attempt: 2,
        created_at_unix_ms: 2_000,
        ..attempt("01B", "in_flight", None)
    };

    let first_claim = repository
        .start_retry_attempt("01A", retry_attempt.clone())
        .await?;
    let second_claim = repository
        .start_retry_attempt(
            "01A",
            SmsCallbackAttemptRecord {
                attempt_id: "01C".to_owned(),
                ..retry_attempt
            },
        )
        .await?;

    assert!(first_claim);
    assert!(!second_claim);
    assert!(repository.list_due_attempts(9_999, 10).await?.is_empty());
    let sent_attempts = repository.list_sent_attempts("01SMS").await?;
    assert_eq!(
        sent_attempts.len(),
        1,
        "the in-flight retry is not listed yet"
    );
    assert_eq!(sent_attempts[0].next_attempt_at_unix_ms, None);
    Ok(())
}

#[tokio::test]
async fn a_restart_queues_unfinished_attempts_again() -> Result<(), StoreError> {
    let repository = repository_with_message().await?;
    repository
        .insert_attempt(attempt("01A", "in_flight", None))
        .await?;

    let requeued_count = repository.requeue_in_flight(5_000).await?;

    assert_eq!(requeued_count, 1);
    let due_attempts = repository.list_due_attempts(5_000, 10).await?;
    assert_eq!(due_attempts.len(), 1);
    assert_eq!(due_attempts[0].status, "pending");
    assert!(repository.start_pending_attempt("01A").await?);
    assert!(!repository.start_pending_attempt("01A").await?);
    Ok(())
}

#[tokio::test]
async fn only_an_in_flight_attempt_can_be_finished() -> Result<(), StoreError> {
    let repository = repository_with_message().await?;
    repository
        .insert_attempt(attempt("01A", "succeeded", None))
        .await?;

    let was_finished = repository
        .finish_attempt("01A", failed_with_retry_at(2_000))
        .await?;

    assert!(!was_finished);
    let sent_attempts = repository.list_sent_attempts("01SMS").await?;
    assert_eq!(sent_attempts[0].status, "succeeded");
    Ok(())
}
