use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, SavedScenarioRecord, SavedScenarioRepository,
    StoreError,
};

fn open_repository() -> Result<SavedScenarioRepository, StoreError> {
    let database = Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?);
    Ok(SavedScenarioRepository::new(database))
}

fn saved_scenario(scenario_id: &str, name: &str) -> SavedScenarioRecord {
    SavedScenarioRecord {
        scenario_id: scenario_id.to_owned(),
        name: name.to_owned(),
        description: String::new(),
        scenario_toml: "name = \"check\"\n".to_owned(),
        created_by: "ui".to_owned(),
        created_at_unix_ms: 1_000,
        updated_at_unix_ms: 1_000,
    }
}

// AC: AI-07.1
#[tokio::test]
async fn saves_lists_by_name_finds_and_deletes_scenarios() -> Result<(), StoreError> {
    let scenario_repository = open_repository()?;
    scenario_repository
        .save_scenario(saved_scenario("sc_2", "signup"))
        .await?;
    scenario_repository
        .save_scenario(saved_scenario("sc_1", "Login"))
        .await?;

    let listed_names: Vec<String> = scenario_repository
        .list_scenarios()
        .await?
        .into_iter()
        .map(|scenario| scenario.name)
        .collect();
    assert_eq!(listed_names, ["Login", "signup"]);
    assert_eq!(
        scenario_repository.find_scenario_by_name("signup").await?,
        Some(saved_scenario("sc_2", "signup"))
    );

    assert!(scenario_repository.delete_scenario("sc_2").await?);
    assert_eq!(scenario_repository.find_scenario("sc_2").await?, None);
    Ok(())
}

#[tokio::test]
async fn replaces_a_scenario_saved_again_with_the_same_id() -> Result<(), StoreError> {
    let scenario_repository = open_repository()?;
    scenario_repository
        .save_scenario(saved_scenario("sc_1", "Login"))
        .await?;

    let renamed_scenario = SavedScenarioRecord {
        name: "Login flow".to_owned(),
        updated_at_unix_ms: 2_000,
        ..saved_scenario("sc_1", "Login")
    };
    scenario_repository
        .save_scenario(renamed_scenario.clone())
        .await?;

    assert_eq!(
        scenario_repository.list_scenarios().await?,
        [renamed_scenario]
    );
    Ok(())
}
