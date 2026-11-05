use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, PaymentDefinitionRecord,
    PaymentDefinitionRepository, StoreError,
};

fn definition(kind: &str, definition_key: &str, definition_json: &str) -> PaymentDefinitionRecord {
    PaymentDefinitionRecord {
        kind: kind.to_owned(),
        definition_key: definition_key.to_owned(),
        definition_json: definition_json.to_owned(),
        updated_at_unix_ms: 1_000,
    }
}

#[tokio::test]
async fn keeps_definitions_per_kind_and_replaces_by_key() -> Result<(), StoreError> {
    let database = Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?);
    let repository = PaymentDefinitionRepository::new(database);
    repository
        .save_definition(definition("flow", "wallet", "{\"v\":1}"))
        .await?;
    repository
        .save_definition(definition("flow", "qr_wallet", "{}"))
        .await?;
    repository
        .save_definition(definition("method", "wallet", "{}"))
        .await?;

    repository
        .save_definition(definition("flow", "wallet", "{\"v\":2}"))
        .await?;
    let was_deleted = repository.delete_definition("flow", "qr_wallet").await?;
    let was_missing_deleted = repository.delete_definition("flow", "qr_wallet").await?;

    assert!(was_deleted);
    assert!(!was_missing_deleted);
    assert_eq!(
        repository.list_definitions("flow").await?,
        vec![definition("flow", "wallet", "{\"v\":2}")]
    );
    assert_eq!(repository.list_definitions("method").await?.len(), 1);
    Ok(())
}
