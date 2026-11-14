use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, RuleMoveDirection, StoreError,
    WebhookRuleRecord, WebhookRuleRepository,
};

fn repository() -> Result<WebhookRuleRepository, StoreError> {
    Ok(WebhookRuleRepository::new(Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?)))
}

fn rule(rule_id: &str, endpoint_id: &str) -> WebhookRuleRecord {
    WebhookRuleRecord {
        rule_id: rule_id.to_owned(),
        position: 0,
        name: format!("Rule {rule_id}"),
        endpoint_id: endpoint_id.to_owned(),
        events_json: r#"["email.received"]"#.to_owned(),
        filter_json: None,
        is_enabled: true,
        created_by: "api".to_owned(),
        created_at_unix_ms: 1_000,
    }
}

async fn ordered_ids(repository: &WebhookRuleRepository) -> Result<Vec<(u32, String)>, StoreError> {
    Ok(repository
        .list_rules()
        .await?
        .into_iter()
        .map(|stored_rule| (stored_rule.position, stored_rule.rule_id))
        .collect())
}

// AC: WH-02.4
#[tokio::test]
async fn rules_keep_their_order_through_moves_and_deletes() -> Result<(), StoreError> {
    let repository = repository()?;
    for rule_id in ["a", "b", "c"] {
        repository.insert_rule(rule(rule_id, "endpoint-1")).await?;
    }

    repository.move_rule("c", RuleMoveDirection::Up).await?;
    repository.delete_rule("a").await?;

    assert_eq!(
        ordered_ids(&repository).await?,
        vec![(1, "c".to_owned()), (2, "b".to_owned())]
    );
    Ok(())
}

#[tokio::test]
async fn deleting_an_endpoint_deletes_its_rules() -> Result<(), StoreError> {
    let repository = repository()?;
    repository.insert_rule(rule("a", "endpoint-1")).await?;
    repository.insert_rule(rule("b", "endpoint-2")).await?;
    repository.insert_rule(rule("c", "endpoint-1")).await?;

    let deleted_count = repository.delete_endpoint_rules("endpoint-1").await?;

    assert_eq!(deleted_count, 2);
    assert_eq!(ordered_ids(&repository).await?, vec![(1, "b".to_owned())]);
    Ok(())
}

#[tokio::test]
async fn an_update_keeps_the_position() -> Result<(), StoreError> {
    let repository = repository()?;
    repository.insert_rule(rule("a", "endpoint-1")).await?;
    repository.insert_rule(rule("b", "endpoint-1")).await?;

    let was_updated = repository
        .update_rule(WebhookRuleRecord {
            is_enabled: false,
            filter_json: Some(r#"{"field":"to","operator":"exists","value":""}"#.to_owned()),
            ..rule("b", "endpoint-2")
        })
        .await?;

    let stored_rule = repository.find_rule("b").await?;
    assert!(was_updated);
    assert_eq!(stored_rule.as_ref().map(|stored| stored.position), Some(2));
    assert_eq!(
        stored_rule.map(|stored| (stored.is_enabled, stored.endpoint_id)),
        Some((false, "endpoint-2".to_owned()))
    );
    Ok(())
}
