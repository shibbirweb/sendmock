use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, EmailOutcomeRuleRecord,
    EmailOutcomeRuleRepository, RuleMoveDirection, StoreError,
};

fn repository() -> Result<EmailOutcomeRuleRepository, StoreError> {
    Ok(EmailOutcomeRuleRepository::new(Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?)))
}

fn rule(rule_id: &str, pattern: &str) -> EmailOutcomeRuleRecord {
    EmailOutcomeRuleRecord {
        rule_id: rule_id.to_owned(),
        position: 0,
        pattern: pattern.to_owned(),
        outcome: "hard_bounce".to_owned(),
        smtp_code: Some("550 5.1.1".to_owned()),
        diagnostic: Some("user unknown".to_owned()),
        note: String::new(),
        is_enabled: true,
        created_by: "api".to_owned(),
        created_at_unix_ms: 1_000,
    }
}

async fn ordered_patterns(
    repository: &EmailOutcomeRuleRepository,
) -> Result<Vec<(u32, String)>, StoreError> {
    Ok(repository
        .list_rules()
        .await?
        .into_iter()
        .map(|stored_rule| (stored_rule.position, stored_rule.pattern))
        .collect())
}

async fn repository_with_three_rules() -> Result<EmailOutcomeRuleRepository, StoreError> {
    let repository = repository()?;
    for (rule_id, pattern) in [
        ("a", "*@bounce.qa.test"),
        ("b", "qa+*@shop.test"),
        ("c", "vip@shop.test"),
    ] {
        repository.insert_rule(rule(rule_id, pattern)).await?;
    }
    Ok(repository)
}

// AC: EM-10.5
#[tokio::test]
async fn new_rules_go_to_the_end_of_the_order() -> Result<(), StoreError> {
    let repository = repository_with_three_rules().await?;

    assert_eq!(
        ordered_patterns(&repository).await?,
        vec![
            (1, "*@bounce.qa.test".to_owned()),
            (2, "qa+*@shop.test".to_owned()),
            (3, "vip@shop.test".to_owned()),
        ]
    );
    Ok(())
}

// AC: EM-10.5
#[tokio::test]
async fn moving_a_rule_swaps_it_with_its_neighbour() -> Result<(), StoreError> {
    let repository = repository_with_three_rules().await?;

    assert!(repository.move_rule("c", RuleMoveDirection::Up).await?);
    assert!(repository.move_rule("c", RuleMoveDirection::Down).await?);
    assert!(repository.move_rule("b", RuleMoveDirection::Up).await?);
    assert!(repository.move_rule("c", RuleMoveDirection::Down).await?);
    assert!(
        !repository
            .move_rule("missing", RuleMoveDirection::Up)
            .await?
    );

    assert_eq!(
        ordered_patterns(&repository).await?,
        vec![
            (1, "qa+*@shop.test".to_owned()),
            (2, "*@bounce.qa.test".to_owned()),
            (3, "vip@shop.test".to_owned()),
        ]
    );
    Ok(())
}

// AC: EM-10.5
#[tokio::test]
async fn deleting_a_rule_closes_the_gap() -> Result<(), StoreError> {
    let repository = repository_with_three_rules().await?;

    assert!(repository.delete_rule("b").await?);
    assert!(!repository.delete_rule("b").await?);

    assert_eq!(
        ordered_patterns(&repository).await?,
        vec![
            (1, "*@bounce.qa.test".to_owned()),
            (2, "vip@shop.test".to_owned()),
        ]
    );
    Ok(())
}

// AC: EM-10.5
#[tokio::test]
async fn editing_keeps_the_position_and_creator() -> Result<(), StoreError> {
    let repository = repository_with_three_rules().await?;
    let mut edited_rule = rule("b", "qa@shop.test");
    edited_rule.outcome = "reject".to_owned();
    edited_rule.smtp_code = None;
    edited_rule.is_enabled = false;
    edited_rule.created_by = "mcp".to_owned();

    assert!(repository.update_rule(edited_rule).await?);
    let stored_rule = repository.find_rule("b").await?;

    assert_eq!(
        stored_rule.map(|stored_rule| (
            stored_rule.position,
            stored_rule.pattern,
            stored_rule.outcome,
            stored_rule.smtp_code,
            stored_rule.is_enabled,
            stored_rule.created_by
        )),
        Some((
            2,
            "qa@shop.test".to_owned(),
            "reject".to_owned(),
            None,
            false,
            "api".to_owned()
        ))
    );
    assert!(!repository.update_rule(rule("missing", "x@y")).await?);
    Ok(())
}
