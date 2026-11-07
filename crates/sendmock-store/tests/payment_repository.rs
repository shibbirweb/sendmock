use std::sync::Arc;

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, PaymentCountColumn, PaymentListFilter,
    PaymentRecord, PaymentRepository, StoreError,
};

fn payment(payment_id: &str, provider: &str, status: &str, currency: &str) -> PaymentRecord {
    PaymentRecord {
        payment_id: payment_id.to_owned(),
        provider: provider.to_owned(),
        method_key: (status == "succeeded").then(|| "card".to_owned()),
        status: status.to_owned(),
        currency: currency.to_owned(),
        document_json: "{}".to_owned(),
        created_at_unix_ms: 1_000,
        updated_at_unix_ms: 1_000,
    }
}

async fn repository_with_payments() -> Result<PaymentRepository, StoreError> {
    let database = Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?);
    let repository = PaymentRepository::new(database);
    for stored_payment in [
        payment("01A", "stripe", "succeeded", "USD"),
        payment("01B", "sslcommerz", "failed", "BDT"),
        payment("01C", "stripe", "requires_payment", "USD"),
    ] {
        repository.save_payment(stored_payment).await?;
    }
    Ok(repository)
}

#[tokio::test]
async fn lists_newest_first_with_filters_and_pages() -> Result<(), StoreError> {
    let repository = repository_with_payments().await?;

    let first_page = repository
        .list_payments(PaymentListFilter::default(), None, 2)
        .await?;
    let second_page = repository
        .list_payments(
            PaymentListFilter::default(),
            first_page.next_cursor.clone(),
            2,
        )
        .await?;
    let stripe_payments = repository
        .list_payments(
            PaymentListFilter {
                statuses: vec!["succeeded".to_owned(), "requires_payment".to_owned()],
                provider: Some("stripe".to_owned()),
                currency: Some("USD".to_owned()),
            },
            None,
            10,
        )
        .await?;

    let ids = |page: &sendmock_store::PaymentPage| -> Vec<String> {
        page.payments
            .iter()
            .map(|stored| stored.payment_id.clone())
            .collect()
    };
    assert_eq!(ids(&first_page), ["01C", "01B"]);
    assert_eq!(first_page.total_count, 3);
    assert_eq!(ids(&second_page), ["01A"]);
    assert_eq!(second_page.next_cursor, None);
    assert_eq!(ids(&stripe_payments), ["01C", "01A"]);
    Ok(())
}

#[tokio::test]
async fn saving_again_updates_and_counts_group_by_gateway_and_method() -> Result<(), StoreError> {
    let repository = repository_with_payments().await?;
    let mut paid = payment("01C", "stripe", "succeeded", "USD");
    paid.document_json = "{\"paid\":true}".to_owned();

    repository.save_payment(paid).await?;
    let provider_counts = repository
        .count_payments_by(PaymentCountColumn::Provider)
        .await?;
    let method_counts = repository
        .count_payments_by(PaymentCountColumn::MethodKey)
        .await?;
    let stored = repository.find_payment("01C").await?;

    assert_eq!(
        stored.map(|stored| (stored.status, stored.document_json)),
        Some(("succeeded".to_owned(), "{\"paid\":true}".to_owned()))
    );
    assert!(provider_counts.contains(&("stripe".to_owned(), 2)));
    assert_eq!(method_counts, vec![("card".to_owned(), 2)]);
    assert_eq!(repository.delete_all_payments().await?, 3);
    Ok(())
}
