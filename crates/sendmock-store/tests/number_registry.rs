use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, MessagingServiceRecord,
    MessagingServiceRepository, StoreError, VirtualNumberRecord, VirtualNumberRepository,
};

fn repositories() -> Result<(VirtualNumberRepository, MessagingServiceRepository), StoreError> {
    let database = Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?);
    Ok((
        VirtualNumberRepository::new(Arc::clone(&database)),
        MessagingServiceRepository::new(database),
    ))
}

fn virtual_number(number_id: &str, e164_number: &str) -> VirtualNumberRecord {
    VirtualNumberRecord {
        number_id: number_id.to_owned(),
        number: e164_number.to_owned(),
        label: "Support line".to_owned(),
        channels: vec!["sms".to_owned(), "whatsapp".to_owned()],
        inbound_url: None,
        inbound_method: "POST".to_owned(),
        inbound_fallback_url: None,
        inbound_template_id: None,
        status_callback_url: None,
        messaging_service_sid: None,
        created_by: "api".to_owned(),
        created_at_unix_ms: 1_000,
    }
}

fn messaging_service(service_sid: &str, number_ids: &[&str]) -> MessagingServiceRecord {
    MessagingServiceRecord {
        service_sid: service_sid.to_owned(),
        friendly_name: "Notifications".to_owned(),
        number_ids: number_ids
            .iter()
            .map(|number_id| (*number_id).to_owned())
            .collect(),
        inbound_mode: "defer_to_sender".to_owned(),
        inbound_url: None,
        inbound_fallback_url: None,
        created_by: "api".to_owned(),
        created_at_unix_ms: 2_000,
    }
}

// AC: SM-12.1
#[tokio::test]
async fn a_number_keeps_its_channels_and_is_found_by_its_value() -> Result<(), StoreError> {
    let (number_repository, _) = repositories()?;

    number_repository
        .insert_number(virtual_number("n1", "+15550001111"))
        .await?;
    let found_number = number_repository.find_by_number("+15550001111").await?;

    assert_eq!(
        found_number.map(|found_number| found_number.channels),
        Some(vec!["sms".to_owned(), "whatsapp".to_owned()])
    );
    assert!(
        number_repository
            .insert_number(virtual_number("n2", "+15550001111"))
            .await
            .is_err()
    );
    Ok(())
}

// AC: SM-03.4
#[tokio::test]
async fn moving_a_number_to_another_pool_updates_both_services() -> Result<(), StoreError> {
    let (number_repository, service_repository) = repositories()?;
    number_repository
        .insert_number(virtual_number("n1", "+15550001111"))
        .await?;
    number_repository
        .insert_number(virtual_number("n2", "+15550002222"))
        .await?;
    service_repository
        .save_service(messaging_service("MG1", &["n1", "n2"]))
        .await?;

    let second_service = service_repository
        .save_service(messaging_service("MG2", &["n2"]))
        .await?;
    let first_service = service_repository.find_service("MG1").await?;

    assert_eq!(second_service.number_ids, vec!["n2"]);
    assert_eq!(
        first_service.map(|service| service.number_ids),
        Some(vec!["n1".to_owned()])
    );
    Ok(())
}

// AC: SM-03.4
#[tokio::test]
async fn deleting_a_service_keeps_its_numbers_outside_any_pool() -> Result<(), StoreError> {
    let (number_repository, service_repository) = repositories()?;
    number_repository
        .insert_number(virtual_number("n1", "+15550001111"))
        .await?;
    service_repository
        .save_service(messaging_service("MG1", &["n1"]))
        .await?;

    assert!(service_repository.delete_service("MG1").await?);
    let kept_number = number_repository.find_number("n1").await?;

    assert_eq!(
        kept_number.map(|kept_number| kept_number.messaging_service_sid),
        Some(None)
    );
    assert!(service_repository.list_services().await?.is_empty());
    Ok(())
}
