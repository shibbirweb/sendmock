use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, StoreError, WebhookEndpointRecord,
    WebhookEndpointRepository, WebhookSecretRotation,
};

fn repository() -> Result<WebhookEndpointRepository, StoreError> {
    Ok(WebhookEndpointRepository::new(Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?)))
}

fn endpoint(endpoint_id: &str, created_at_unix_ms: i64) -> WebhookEndpointRecord {
    WebhookEndpointRecord {
        endpoint_id: endpoint_id.to_owned(),
        name: format!("Endpoint {endpoint_id}"),
        url: "http://localhost:3000/hooks".to_owned(),
        is_enabled: true,
        request_settings_json: r#"{"method":"POST"}"#.to_owned(),
        detached_template_json: None,
        signing_secret: "whsec_first".to_owned(),
        previous_signing_secret: None,
        previous_secret_expires_at_unix_ms: None,
        created_by: "api".to_owned(),
        created_at_unix_ms,
    }
}

#[tokio::test]
async fn lists_endpoints_oldest_first() -> Result<(), StoreError> {
    let repository = repository()?;
    repository.insert_endpoint(endpoint("b", 2_000)).await?;
    repository.insert_endpoint(endpoint("a", 1_000)).await?;

    let endpoint_ids: Vec<String> = repository
        .list_endpoints()
        .await?
        .into_iter()
        .map(|stored_endpoint| stored_endpoint.endpoint_id)
        .collect();

    assert_eq!(endpoint_ids, vec!["a".to_owned(), "b".to_owned()]);
    Ok(())
}

#[tokio::test]
async fn an_update_keeps_the_secret_and_creator() -> Result<(), StoreError> {
    let repository = repository()?;
    repository.insert_endpoint(endpoint("a", 1_000)).await?;

    let was_updated = repository
        .update_endpoint(WebhookEndpointRecord {
            name: "Orders app".to_owned(),
            is_enabled: false,
            signing_secret: "whsec_ignored".to_owned(),
            created_by: "seed".to_owned(),
            ..endpoint("a", 1_000)
        })
        .await?;

    let stored_endpoint = repository.find_endpoint("a").await?;
    assert!(was_updated);
    assert_eq!(
        stored_endpoint,
        Some(WebhookEndpointRecord {
            name: "Orders app".to_owned(),
            is_enabled: false,
            ..endpoint("a", 1_000)
        })
    );
    Ok(())
}

// AC: WH-09.2
#[tokio::test]
async fn an_update_saves_and_clears_the_detached_template_copy() -> Result<(), StoreError> {
    let repository = repository()?;
    repository.insert_endpoint(endpoint("a", 1_000)).await?;
    let detached_template_json = Some(r#"{"method":"POST","body_template":"{}"}"#.to_owned());

    repository
        .update_endpoint(WebhookEndpointRecord {
            detached_template_json: detached_template_json.clone(),
            ..endpoint("a", 1_000)
        })
        .await?;
    let detached_endpoint = repository.find_endpoint("a").await?;
    repository.update_endpoint(endpoint("a", 1_000)).await?;
    let linked_endpoint = repository.find_endpoint("a").await?;

    assert_eq!(
        detached_endpoint.and_then(|stored_endpoint| stored_endpoint.detached_template_json),
        detached_template_json
    );
    assert_eq!(
        linked_endpoint.and_then(|stored_endpoint| stored_endpoint.detached_template_json),
        None
    );
    Ok(())
}

// AC: WH-04.3
#[tokio::test]
async fn rotating_keeps_the_old_secret_as_the_previous_one() -> Result<(), StoreError> {
    let repository = repository()?;
    repository.insert_endpoint(endpoint("a", 1_000)).await?;

    let was_rotated = repository
        .rotate_signing_secret(
            "a",
            WebhookSecretRotation {
                new_signing_secret: "whsec_second".to_owned(),
                previous_secret_expires_at_unix_ms: 90_000,
            },
        )
        .await?;

    let stored_endpoint = repository.find_endpoint("a").await?;
    assert!(was_rotated);
    assert_eq!(
        stored_endpoint.map(|stored| (
            stored.signing_secret,
            stored.previous_signing_secret,
            stored.previous_secret_expires_at_unix_ms,
        )),
        Some((
            "whsec_second".to_owned(),
            Some("whsec_first".to_owned()),
            Some(90_000),
        ))
    );
    Ok(())
}

#[tokio::test]
async fn changes_to_a_missing_endpoint_report_false() -> Result<(), StoreError> {
    let repository = repository()?;

    assert!(!repository.update_endpoint(endpoint("gone", 1_000)).await?);
    assert!(!repository.delete_endpoint("gone").await?);
    assert!(
        !repository
            .rotate_signing_secret(
                "gone",
                WebhookSecretRotation {
                    new_signing_secret: "whsec_second".to_owned(),
                    previous_secret_expires_at_unix_ms: 90_000,
                },
            )
            .await?
    );
    Ok(())
}

#[tokio::test]
async fn deleting_removes_the_endpoint() -> Result<(), StoreError> {
    let repository = repository()?;
    repository.insert_endpoint(endpoint("a", 1_000)).await?;

    assert!(repository.delete_endpoint("a").await?);
    assert_eq!(repository.find_endpoint("a").await?, None);
    Ok(())
}
