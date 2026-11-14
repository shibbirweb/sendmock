use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, SeedStateRecord, SeedStateRepository,
    StoreError,
};

fn seed_state(seed_toml: &str, applied_at_unix_ms: i64) -> SeedStateRecord {
    SeedStateRecord {
        seed_toml: seed_toml.to_owned(),
        source_path: Some("/config/sendmock.seed.toml".to_owned()),
        applied_at_unix_ms,
        applied_items_json: "[]".to_owned(),
    }
}

#[tokio::test]
async fn keeps_only_the_seed_applied_last() -> Result<(), StoreError> {
    let database = Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?);
    let seed_state_repository = SeedStateRepository::new(database);
    assert_eq!(seed_state_repository.find_state().await?, None);

    seed_state_repository
        .save_state(seed_state("[settings]\n", 1_000))
        .await?;
    seed_state_repository
        .save_state(seed_state("[[numbers]]\n", 2_000))
        .await?;

    assert_eq!(
        seed_state_repository.find_state().await?,
        Some(seed_state("[[numbers]]\n", 2_000))
    );
    Ok(())
}
