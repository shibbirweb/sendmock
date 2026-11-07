use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, PaymentProviderObjectRecord,
    PaymentProviderObjectRepository, PaymentRecord, PaymentRepository, StoreError,
};

fn stripe_payment(payment_id: &str, payment_intent_id: &str) -> PaymentRecord {
    PaymentRecord {
        payment_id: payment_id.to_owned(),
        provider: "stripe".to_owned(),
        method_key: None,
        status: "succeeded".to_owned(),
        currency: "USD".to_owned(),
        document_json: format!(r#"{{"provider_ids":{{"payment_intent":"{payment_intent_id}"}}}}"#),
        created_at_unix_ms: 1_000,
        updated_at_unix_ms: 1_000,
    }
}

fn refund(
    refund_id: &str,
    payment_id: &str,
    created_at_unix_ms: i64,
) -> PaymentProviderObjectRecord {
    PaymentProviderObjectRecord {
        object_id: refund_id.to_owned(),
        provider: "stripe".to_owned(),
        object_kind: "refund".to_owned(),
        payment_id: payment_id.to_owned(),
        document_json: r#"{"amount":500}"#.to_owned(),
        created_at_unix_ms,
        updated_at_unix_ms: created_at_unix_ms,
    }
}

fn open_database() -> Result<Arc<Database>, StoreError> {
    Ok(Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?))
}

#[tokio::test]
async fn finds_a_payment_by_the_id_its_provider_gave_it() -> Result<(), StoreError> {
    let payment_repository = PaymentRepository::new(open_database()?);
    payment_repository
        .save_payment(stripe_payment("01A", "pi_first"))
        .await?;
    payment_repository
        .save_payment(stripe_payment("01B", "pi_second"))
        .await?;

    let found_payment = payment_repository
        .find_payment_by_provider_id("stripe", "pi_second")
        .await?;
    let other_provider = payment_repository
        .find_payment_by_provider_id("paypal", "pi_second")
        .await?;

    assert_eq!(
        found_payment.map(|payment| payment.payment_id).as_deref(),
        Some("01B")
    );
    assert_eq!(other_provider, None);
    Ok(())
}

#[tokio::test]
async fn keeps_provider_objects_until_their_payment_is_deleted() -> Result<(), StoreError> {
    let database = open_database()?;
    let payment_repository = PaymentRepository::new(Arc::clone(&database));
    let object_repository = PaymentProviderObjectRepository::new(database);
    payment_repository
        .save_payment(stripe_payment("01A", "pi_first"))
        .await?;
    object_repository
        .save_object(refund("re_2", "01A", 2_000))
        .await?;
    object_repository
        .save_object(refund("re_1", "01A", 1_000))
        .await?;

    let found_refund = object_repository
        .find_object("stripe", "refund", "re_1")
        .await?;
    let refund_ids: Vec<String> = object_repository
        .list_payment_objects("01A", "refund")
        .await?
        .into_iter()
        .map(|provider_object| provider_object.object_id)
        .collect();
    payment_repository.delete_all_payments().await?;
    let refunds_after_delete = object_repository
        .list_payment_objects("01A", "refund")
        .await?;

    assert_eq!(
        found_refund.map(|record| record.payment_id).as_deref(),
        Some("01A")
    );
    assert_eq!(refund_ids, vec!["re_1".to_owned(), "re_2".to_owned()]);
    assert!(refunds_after_delete.is_empty());
    Ok(())
}
