use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, RuleMoveDirection, SmsOutcomeRuleRecord,
    SmsOutcomeRuleRepository, StoreError,
};

fn repository() -> Result<SmsOutcomeRuleRepository, StoreError> {
    Ok(SmsOutcomeRuleRepository::new(Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?)))
}

fn rule(rule_id: &str, pattern: &str) -> SmsOutcomeRuleRecord {
    SmsOutcomeRuleRecord {
        rule_id: rule_id.to_owned(),
        position: 0,
        match_field: "to".to_owned(),
        pattern: pattern.to_owned(),
        outcome: "undelivered".to_owned(),
        error_code: Some("30007".to_owned()),
        delay_seconds: None,
        note: String::new(),
        is_enabled: true,
        created_by: "api".to_owned(),
        created_at_unix_ms: 1_000,
    }
}

async fn ordered_patterns(
    repository: &SmsOutcomeRuleRepository,
) -> Result<Vec<(u32, String)>, StoreError> {
    Ok(repository
        .list_rules()
        .await?
        .into_iter()
        .map(|stored_rule| (stored_rule.position, stored_rule.pattern))
        .collect())
}

async fn repository_with_three_rules() -> Result<SmsOutcomeRuleRepository, StoreError> {
    let repository = repository()?;
    for (rule_id, pattern) in [("a", "+1555000*"), ("b", "+1555111*"), ("c", "+1555222*")] {
        repository.insert_rule(rule(rule_id, pattern)).await?;
    }
    Ok(repository)
}

// AC: SM-07.7
#[tokio::test]
async fn new_rules_go_to_the_end_of_the_order() -> Result<(), StoreError> {
    let repository = repository_with_three_rules().await?;

    assert_eq!(
        ordered_patterns(&repository).await?,
        vec![
            (1, "+1555000*".to_owned()),
            (2, "+1555111*".to_owned()),
            (3, "+1555222*".to_owned()),
        ]
    );
    Ok(())
}

// AC: SM-07.7
#[tokio::test]
async fn moving_a_rule_swaps_it_with_its_neighbour() -> Result<(), StoreError> {
    let repository = repository_with_three_rules().await?;

    assert!(repository.move_rule("c", RuleMoveDirection::Up).await?);
    assert!(repository.move_rule("a", RuleMoveDirection::Up).await?);
    assert!(
        !repository
            .move_rule("missing", RuleMoveDirection::Down)
            .await?
    );

    assert_eq!(
        ordered_patterns(&repository).await?,
        vec![
            (1, "+1555000*".to_owned()),
            (2, "+1555222*".to_owned()),
            (3, "+1555111*".to_owned()),
        ]
    );
    Ok(())
}

// AC: SM-07.7
#[tokio::test]
async fn deleting_a_rule_closes_the_gap() -> Result<(), StoreError> {
    let repository = repository_with_three_rules().await?;

    assert!(repository.delete_rule("a").await?);

    assert_eq!(
        ordered_patterns(&repository).await?,
        vec![(1, "+1555111*".to_owned()), (2, "+1555222*".to_owned())]
    );
    Ok(())
}

// AC: SM-07.7
#[tokio::test]
async fn editing_keeps_the_position_and_creator() -> Result<(), StoreError> {
    let repository = repository_with_three_rules().await?;
    let mut edited_rule = rule("b", "+1555999*");
    edited_rule.is_enabled = false;
    edited_rule.created_by = "mcp".to_owned();

    assert!(repository.update_rule(edited_rule).await?);
    let stored_rule = repository.find_rule("b").await?;

    assert_eq!(
        stored_rule.map(|stored_rule| (
            stored_rule.position,
            stored_rule.pattern,
            stored_rule.is_enabled,
            stored_rule.created_by
        )),
        Some((2, "+1555999*".to_owned(), false, "api".to_owned()))
    );
    assert!(!repository.update_rule(rule("missing", "+1")).await?);
    Ok(())
}
