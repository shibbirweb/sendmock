use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, SavedWebhookDeliveryRecord,
    SavedWebhookDeliveryRepository, StoreError, WebhookDeliveryRecord, WebhookDeliveryRepository,
};

fn open_database() -> Result<Arc<Database>, StoreError> {
    Ok(Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?))
}

fn saved_delivery(saved_id: &str, saved_at_unix_ms: i64) -> SavedWebhookDeliveryRecord {
    SavedWebhookDeliveryRecord {
        saved_id: saved_id.to_owned(),
        name: format!("Saved {saved_id}"),
        endpoint_id: Some("endpoint-1".to_owned()),
        event_type: Some("email.received".to_owned()),
        event_json: Some(r#"{"type":"email.received"}"#.to_owned()),
        template_id: "native".to_owned(),
        request_json: r#"{"method":"POST","url":"http://127.0.0.1/hook","headers":{},"body":"{}"}"#
            .to_owned(),
        saved_at_unix_ms,
    }
}

fn sent_delivery(delivery_id: &str) -> WebhookDeliveryRecord {
    WebhookDeliveryRecord {
        delivery_id: delivery_id.to_owned(),
        endpoint_id: "endpoint-1".to_owned(),
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
        sent_request_json: None,
        response_json: None,
        duration_ms: Some(12),
        error_message: None,
        next_attempt_at_unix_ms: None,
        created_at_unix_ms: 1_000,
    }
}

fn listed_ids(saved_deliveries: &[SavedWebhookDeliveryRecord]) -> Vec<&str> {
    saved_deliveries
        .iter()
        .map(|saved_delivery| saved_delivery.saved_id.as_str())
        .collect()
}

// AC: WH-10.4
#[tokio::test]
async fn saved_deliveries_list_newest_first_with_ties_in_insertion_order() -> Result<(), StoreError>
{
    let repository = SavedWebhookDeliveryRepository::new(open_database()?);
    repository
        .insert_saved_delivery(saved_delivery("s1", 1_000))
        .await?;
    repository
        .insert_saved_delivery(saved_delivery("s2", 3_000))
        .await?;
    repository
        .insert_saved_delivery(saved_delivery("s3", 3_000))
        .await?;

    let saved_deliveries = repository.list_saved_deliveries().await?;

    assert_eq!(listed_ids(&saved_deliveries), vec!["s3", "s2", "s1"]);
    Ok(())
}

// AC: WH-10.4
#[tokio::test]
async fn a_saved_delivery_is_renamed_and_deleted() -> Result<(), StoreError> {
    let repository = SavedWebhookDeliveryRepository::new(open_database()?);
    repository
        .insert_saved_delivery(saved_delivery("s1", 1_000))
        .await?;

    let was_renamed = repository
        .rename_saved_delivery("s1", "Order webhook")
        .await?;
    let renamed_name = repository
        .find_saved_delivery("s1")
        .await?
        .map(|saved_delivery| saved_delivery.name);
    let was_deleted = repository.delete_saved_delivery("s1").await?;
    let was_deleted_again = repository.delete_saved_delivery("s1").await?;

    assert!(was_renamed);
    assert_eq!(renamed_name.as_deref(), Some("Order webhook"));
    assert!(was_deleted);
    assert!(!was_deleted_again);
    assert!(!repository.rename_saved_delivery("s1", "Gone").await?);
    Ok(())
}

// AC: WH-10.1
#[tokio::test]
async fn saved_deliveries_stay_when_every_delivery_is_deleted() -> Result<(), StoreError> {
    let database = open_database()?;
    let delivery_repository = WebhookDeliveryRepository::new(Arc::clone(&database));
    let saved_repository = SavedWebhookDeliveryRepository::new(database);
    delivery_repository
        .insert_delivery(sent_delivery("d1"))
        .await?;
    saved_repository
        .insert_saved_delivery(saved_delivery("s1", 1_000))
        .await?;

    let deleted_delivery_count = delivery_repository.delete_all_deliveries().await?;

    assert_eq!(deleted_delivery_count, 1);
    assert!(delivery_repository.find_delivery("d1").await?.is_none());
    assert_eq!(
        listed_ids(&saved_repository.list_saved_deliveries().await?),
        vec!["s1"]
    );
    Ok(())
}

#[tokio::test]
async fn deleting_an_endpoint_keeps_its_saved_deliveries_without_it() -> Result<(), StoreError> {
    let repository = SavedWebhookDeliveryRepository::new(open_database()?);
    repository
        .insert_saved_delivery(saved_delivery("s1", 1_000))
        .await?;

    let forgotten_count = repository.forget_endpoint("endpoint-1").await?;
    let kept_delivery = repository.find_saved_delivery("s1").await?;

    assert_eq!(forgotten_count, 1);
    assert_eq!(
        kept_delivery.map(|saved_delivery| saved_delivery.endpoint_id),
        Some(None)
    );
    Ok(())
}
