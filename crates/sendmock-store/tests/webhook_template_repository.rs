use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, StoreError, WebhookTemplateRecord,
    WebhookTemplateRepository, WebhookTemplateRevisionRecord,
};

fn repository() -> Result<WebhookTemplateRepository, StoreError> {
    Ok(WebhookTemplateRepository::new(Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?)))
}

fn template(template_id: &str, revision: u32) -> WebhookTemplateRecord {
    WebhookTemplateRecord {
        template_id: template_id.to_owned(),
        source: "custom".to_owned(),
        name: "Order webhook".to_owned(),
        service: "Custom".to_owned(),
        description: String::new(),
        events_json: r#"["email.received"]"#.to_owned(),
        required_variables_json: "[]".to_owned(),
        method: "POST".to_owned(),
        content_type: "application/json".to_owned(),
        header_templates_json: "{}".to_owned(),
        body_template: "{}".to_owned(),
        revision,
        updated_at_unix_ms: 1_000,
    }
}

fn revision(template_id: &str, revision_number: u32) -> WebhookTemplateRevisionRecord {
    WebhookTemplateRevisionRecord {
        template_id: template_id.to_owned(),
        revision: revision_number,
        saved_at_unix_ms: i64::from(revision_number),
        template_json: "{}".to_owned(),
    }
}

// AC: WH-09.1
#[tokio::test]
async fn saving_twice_replaces_the_template() -> Result<(), StoreError> {
    let repository = repository()?;

    repository
        .save_template(template("custom.orders", 1))
        .await?;
    repository
        .save_template(template("custom.orders", 2))
        .await?;

    let stored_templates = repository.list_templates().await?;
    assert_eq!(stored_templates.len(), 1);
    assert_eq!(stored_templates[0].revision, 2);
    Ok(())
}

// AC: WH-09.5
#[tokio::test]
async fn only_the_newest_revisions_are_kept_newest_first() -> Result<(), StoreError> {
    let repository = repository()?;

    for revision_number in 1..=5 {
        repository
            .insert_revision(revision("custom.orders", revision_number), 3)
            .await?;
    }

    let kept_revisions: Vec<u32> = repository
        .list_revisions("custom.orders")
        .await?
        .iter()
        .map(|kept_revision| kept_revision.revision)
        .collect();
    assert_eq!(kept_revisions, vec![5, 4, 3]);
    Ok(())
}

#[tokio::test]
async fn deleting_a_template_deletes_its_revisions() -> Result<(), StoreError> {
    let repository = repository()?;
    repository
        .save_template(template("custom.orders", 1))
        .await?;
    repository
        .insert_revision(revision("custom.orders", 1), 20)
        .await?;

    let was_deleted = repository.delete_template("custom.orders").await?;

    assert!(was_deleted);
    assert!(repository.find_template("custom.orders").await?.is_none());
    assert!(repository.list_revisions("custom.orders").await?.is_empty());
    Ok(())
}
