use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, NewSmsRecord, SmsCallbackAttemptRecord,
    SmsListFilter, SmsMediaRecord, SmsRecord, SmsRepository, SmsStatusChangeRecord, StoreError,
};

fn repository() -> Result<SmsRepository, StoreError> {
    Ok(SmsRepository::new(Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?)))
}

fn sms(sms_id: &str, direction: &str, body: &str) -> SmsRecord {
    let (app_number, contact_number) = ("+15550001111", "+8801700000000");
    let (from_number, to_number) = if direction == "outbound" {
        (app_number, contact_number)
    } else {
        (contact_number, app_number)
    };
    SmsRecord {
        sms_id: sms_id.to_owned(),
        provider_id: format!("SM{sms_id}"),
        direction: direction.to_owned(),
        channel: "sms".to_owned(),
        api: "native".to_owned(),
        from_number: from_number.to_owned(),
        from_raw: from_number.to_owned(),
        to_number: to_number.to_owned(),
        to_raw: to_number.to_owned(),
        thread_id: "sms-15550001111-8801700000000".to_owned(),
        app_number: app_number.to_owned(),
        contact_number: contact_number.to_owned(),
        body: body.to_owned(),
        encoding: "GSM-7".to_owned(),
        segments: 1,
        status: if direction == "outbound" {
            "queued"
        } else {
            "received"
        }
        .to_owned(),
        error_code: None,
        status_callback_url: None,
        messaging_service_sid: None,
        account: None,
        otp_codes: vec!["482913".to_owned()],
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

fn plain(sms: SmsRecord) -> NewSmsRecord {
    NewSmsRecord {
        sms,
        media_contents: Vec::new(),
    }
}

#[tokio::test]
async fn stores_a_message_with_its_media_and_first_status() -> Result<(), StoreError> {
    let repository = repository()?;
    let mut with_media = sms("01A", "outbound", "See the receipt");
    with_media.media = vec![SmsMediaRecord {
        media_index: 0,
        content_type: "image/png".to_owned(),
        filename: Some("receipt.png".to_owned()),
        source_url: None,
        size_bytes: 3,
    }];

    repository
        .insert_message(NewSmsRecord {
            sms: with_media.clone(),
            media_contents: vec![vec![1, 2, 3]],
        })
        .await?;

    assert_eq!(repository.find_message("01A").await?, Some(with_media));
    assert_eq!(
        repository.read_media_content("01A", 0).await?,
        Some((
            "image/png".to_owned(),
            Some("receipt.png".to_owned()),
            vec![1, 2, 3]
        ))
    );
    assert_eq!(repository.list_status_history("01A").await?.len(), 1);
    Ok(())
}

#[tokio::test]
async fn status_changes_update_the_message_and_append_to_its_history() -> Result<(), StoreError> {
    let repository = repository()?;
    repository
        .insert_message(plain(sms("01A", "outbound", "Hi")))
        .await?;

    let delivered = repository
        .record_status_change(
            "01A",
            SmsStatusChangeRecord {
                status: "delivered".to_owned(),
                error_code: None,
                at_unix_ms: 2_000,
            },
        )
        .await?;
    let missing = repository
        .record_status_change(
            "01Z",
            SmsStatusChangeRecord {
                status: "delivered".to_owned(),
                error_code: None,
                at_unix_ms: 2_000,
            },
        )
        .await?;

    let history: Vec<String> = repository
        .list_status_history("01A")
        .await?
        .into_iter()
        .map(|change| change.status)
        .collect();
    assert_eq!(
        delivered.map(|message| message.status).as_deref(),
        Some("delivered")
    );
    assert_eq!(missing, None);
    assert_eq!(history, ["queued", "delivered"]);
    Ok(())
}

#[tokio::test]
async fn lists_with_filters_and_groups_conversations() -> Result<(), StoreError> {
    let repository = repository()?;
    repository
        .insert_message(plain(sms("01A", "outbound", "Your code is 482913")))
        .await?;
    repository
        .insert_message(plain(sms("01B", "inbound", "STOP")))
        .await?;
    repository
        .insert_message(plain(sms("01C", "inbound", "start")))
        .await?;

    let inbound_page = repository
        .list_messages(
            SmsListFilter {
                direction: Some("inbound".to_owned()),
                ..SmsListFilter::default()
            },
            None,
            50,
        )
        .await?;
    let searched_page = repository
        .list_messages(
            SmsListFilter {
                search_text: Some("stop".to_owned()),
                ..SmsListFilter::default()
            },
            None,
            50,
        )
        .await?;
    let threads = repository.list_threads().await?;

    assert_eq!(inbound_page.total_count, 2);
    assert_eq!(searched_page.messages.len(), 1);
    assert_eq!(threads.len(), 1);
    assert_eq!(threads[0].last_message.sms_id, "01C");
    assert_eq!((threads[0].message_count, threads[0].unread_count), (3, 2));
    repository
        .mark_thread_read("sms-15550001111-8801700000000")
        .await?;
    assert_eq!(repository.list_threads().await?[0].unread_count, 0);
    Ok(())
}

#[tokio::test]
async fn keeps_callback_attempts_and_prunes_old_messages() -> Result<(), StoreError> {
    let repository = repository()?;
    for sms_id in ["01A", "01B", "01C"] {
        repository
            .insert_message(plain(sms(sms_id, "outbound", "Hi")))
            .await?;
    }
    repository
        .add_callback_attempt(SmsCallbackAttemptRecord {
            attempt_id: "01CB".to_owned(),
            sms_id: "01C".to_owned(),
            reported_status: "sent".to_owned(),
            attempt: 1,
            request_json: "{}".to_owned(),
            response_json: None,
            duration_ms: Some(4),
            error_message: Some("connection refused".to_owned()),
            created_at_unix_ms: 1_500,
        })
        .await?;

    let pruned_count = repository.prune_messages(2, None).await?;

    assert_eq!(pruned_count, 1);
    assert_eq!(repository.find_message("01A").await?, None);
    assert_eq!(repository.list_callback_attempts("01C").await?.len(), 1);
    assert!(repository.delete_message("01C").await?);
    assert_eq!(repository.delete_all_messages().await?, 1);
    Ok(())
}
