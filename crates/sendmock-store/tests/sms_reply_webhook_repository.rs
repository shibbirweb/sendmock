use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, NewSmsRecord, SmsRecord,
    SmsReplyWebhookAttemptRecord, SmsReplyWebhookRepository, SmsRepository, StoreError,
};

const SMS_ID: &str = "01INBOUND";

struct Repositories {
    sms_repository: SmsRepository,
    reply_webhook_repository: SmsReplyWebhookRepository,
}

async fn repositories_with_inbound_message() -> Result<Repositories, StoreError> {
    let database = Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?);
    let sms_repository = SmsRepository::new(Arc::clone(&database));
    sms_repository
        .insert_message(NewSmsRecord {
            sms: inbound_sms(),
            media_contents: Vec::new(),
        })
        .await?;
    Ok(Repositories {
        sms_repository,
        reply_webhook_repository: SmsReplyWebhookRepository::new(database),
    })
}

fn inbound_sms() -> SmsRecord {
    SmsRecord {
        sms_id: SMS_ID.to_owned(),
        project_key: "default".to_owned(),
        provider_id: "SM01".to_owned(),
        direction: "inbound".to_owned(),
        channel: "sms".to_owned(),
        api: "native".to_owned(),
        from_number: "+8801700000000".to_owned(),
        from_raw: "+8801700000000".to_owned(),
        to_number: "+15550001111".to_owned(),
        to_raw: "+15550001111".to_owned(),
        thread_id: "sms-15550001111-8801700000000".to_owned(),
        app_number: "+15550001111".to_owned(),
        contact_number: "+8801700000000".to_owned(),
        body: "YES".to_owned(),
        encoding: "GSM-7".to_owned(),
        segments: 1,
        status: "received".to_owned(),
        error_code: None,
        status_callback_url: None,
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
        reply_webhook_json: None,
        media: Vec::new(),
    }
}

fn attempt(
    attempt_id: &str,
    is_fallback: bool,
    created_at_unix_ms: i64,
) -> SmsReplyWebhookAttemptRecord {
    SmsReplyWebhookAttemptRecord {
        attempt_id: attempt_id.to_owned(),
        sms_id: SMS_ID.to_owned(),
        is_fallback,
        request_json: r#"{"method":"POST"}"#.to_owned(),
        response_json: None,
        duration_ms: Some(12),
        error_code: Some("11205".to_owned()),
        error_message: Some("HTTP connection failure".to_owned()),
        twiml_json: "[]".to_owned(),
        created_at_unix_ms,
    }
}

#[tokio::test]
async fn lists_attempts_oldest_first_with_their_fields() -> Result<(), StoreError> {
    let repositories = repositories_with_inbound_message().await?;
    let reply_webhook_repository = &repositories.reply_webhook_repository;
    reply_webhook_repository
        .insert_attempt(attempt("02FALLBACK", true, 2_000))
        .await?;
    reply_webhook_repository
        .insert_attempt(attempt("01PRIMARY", false, 2_000))
        .await?;
    reply_webhook_repository
        .insert_attempt(attempt("00RESEND", false, 3_000))
        .await?;

    let attempts = reply_webhook_repository.list_attempts(SMS_ID).await?;

    let attempt_ids: Vec<&str> = attempts
        .iter()
        .map(|stored_attempt| stored_attempt.attempt_id.as_str())
        .collect();
    assert_eq!(attempt_ids, ["02FALLBACK", "01PRIMARY", "00RESEND"]);
    assert_eq!(attempts[0], attempt("02FALLBACK", true, 2_000));
    Ok(())
}

#[tokio::test]
async fn the_latest_result_replaces_the_one_before() -> Result<(), StoreError> {
    let repositories = repositories_with_inbound_message().await?;
    let reply_webhook_repository = &repositories.reply_webhook_repository;

    reply_webhook_repository
        .record_result(SMS_ID, r#"{"outcome":"failed"}"#.to_owned())
        .await?;
    let is_recorded = reply_webhook_repository
        .record_result(SMS_ID, r#"{"outcome":"succeeded"}"#.to_owned())
        .await?;

    assert!(is_recorded);
    let stored_sms = repositories.sms_repository.find_message(SMS_ID).await?;
    assert_eq!(
        stored_sms.and_then(|stored_sms| stored_sms.reply_webhook_json),
        Some(r#"{"outcome":"succeeded"}"#.to_owned())
    );
    assert!(
        !reply_webhook_repository
            .record_result("01GONE", "{}".to_owned())
            .await?
    );
    Ok(())
}

#[tokio::test]
async fn deleting_the_message_deletes_its_attempts() -> Result<(), StoreError> {
    let repositories = repositories_with_inbound_message().await?;
    repositories
        .reply_webhook_repository
        .insert_attempt(attempt("01PRIMARY", false, 2_000))
        .await?;

    repositories.sms_repository.delete_message(SMS_ID).await?;

    let attempts = repositories
        .reply_webhook_repository
        .list_attempts(SMS_ID)
        .await?;
    assert!(attempts.is_empty());
    Ok(())
}
