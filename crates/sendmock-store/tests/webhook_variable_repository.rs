use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, StoreError, WebhookVariableRecord,
    WebhookVariableRepository,
};

fn repository() -> Result<WebhookVariableRepository, StoreError> {
    Ok(WebhookVariableRepository::new(Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?)))
}

fn variable(variable_id: &str, name: &str, endpoint_id: Option<&str>) -> WebhookVariableRecord {
    WebhookVariableRecord {
        variable_id: variable_id.to_owned(),
        name: name.to_owned(),
        kind: "text".to_owned(),
        endpoint_id: endpoint_id.map(str::to_owned),
        value: "acme".to_owned(),
        random_mode: None,
        fixed_value: None,
        description: String::new(),
        created_by: "api".to_owned(),
        created_at_unix_ms: 1_000,
    }
}

fn listed_ids(stored_variables: &[WebhookVariableRecord]) -> Vec<&str> {
    stored_variables
        .iter()
        .map(|stored_variable| stored_variable.variable_id.as_str())
        .collect()
}

// AC: WH-07.2
#[tokio::test]
async fn an_endpoint_reads_global_variables_and_its_own() -> Result<(), StoreError> {
    let repository = repository()?;
    repository
        .insert_variable(variable("v1", "tenant", Some("e1")))
        .await?;
    repository
        .insert_variable(variable("v2", "tenant", None))
        .await?;
    repository
        .insert_variable(variable("v3", "region", Some("e2")))
        .await?;

    let every_variable = repository.list_variables(None).await?;
    let first_endpoint_variables = repository.list_variables(Some("e1")).await?;
    let first_endpoint_scope = repository.list_endpoint_scope_variables("e1").await?;

    assert_eq!(listed_ids(&every_variable), vec!["v2", "v1", "v3"]);
    assert_eq!(listed_ids(&first_endpoint_variables), vec!["v1"]);
    assert_eq!(listed_ids(&first_endpoint_scope), vec!["v2", "v1"]);
    Ok(())
}

#[tokio::test]
async fn a_name_is_unique_within_its_scope() -> Result<(), StoreError> {
    let repository = repository()?;
    repository
        .insert_variable(variable("v1", "tenant", None))
        .await?;

    let duplicate_global = repository
        .insert_variable(variable("v2", "tenant", None))
        .await;
    let same_name_on_endpoint = repository
        .insert_variable(variable("v3", "tenant", Some("e1")))
        .await;

    assert!(duplicate_global.is_err());
    assert!(same_name_on_endpoint.is_ok());
    Ok(())
}

#[tokio::test]
async fn variables_are_changed_and_deleted() -> Result<(), StoreError> {
    let repository = repository()?;
    repository
        .insert_variable(variable("v1", "nonce", Some("e1")))
        .await?;
    repository
        .insert_variable(variable("v2", "other", Some("e1")))
        .await?;
    let fixed_random = WebhookVariableRecord {
        kind: "random".to_owned(),
        value: "random_string(8)".to_owned(),
        random_mode: Some("fixed".to_owned()),
        fixed_value: Some("Ab3dE6gH".to_owned()),
        ..variable("v1", "nonce", Some("e1"))
    };

    let was_updated = repository.update_variable(fixed_random.clone()).await?;
    let stored_variable = repository.find_variable("v1").await?;
    let deleted_count = repository.delete_endpoint_variables("e1").await?;

    assert!(was_updated);
    assert_eq!(stored_variable, Some(fixed_random));
    assert_eq!(deleted_count, 2);
    assert!(!repository.delete_variable("v1").await?);
    assert!(
        !repository
            .update_variable(variable("gone", "x", None))
            .await?
    );
    Ok(())
}
