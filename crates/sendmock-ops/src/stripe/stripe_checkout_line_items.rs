use serde_json::Value;

use super::stripe_error::StripeError;
use super::stripe_fields::{StripeFields, describe_param};
use super::stripe_payment_intents::read_currency;
use crate::payments::PaymentLineItem;

/// The order's lines and their one currency, from `line_items[n][price_data]`.
pub struct CheckoutLineItems {
    pub line_items: Vec<PaymentLineItem>,
    pub currency: String,
}

impl CheckoutLineItems {
    pub fn total_minor(&self) -> u64 {
        self.line_items
            .iter()
            .map(|line_item| u64::from(line_item.quantity) * line_item.unit_amount_minor)
            .sum()
    }
}

/// `line_items[<index>][<field names>]` as a path.
fn build_item_path<'index>(
    index_text: &'index str,
    field_names: &[&'static str],
) -> Vec<&'index str> {
    let mut item_path = vec!["line_items", index_text];
    item_path.extend_from_slice(field_names);
    item_path
}

fn read_line_item(
    stripe_fields: &StripeFields,
    item_index: usize,
) -> Result<(PaymentLineItem, String), StripeError> {
    let index_text = item_index.to_string();
    let price_path = build_item_path(&index_text, &["price"]);
    if let Some(price_id) = stripe_fields.text(&price_path) {
        return Err(StripeError::invalid_request(
            400,
            Some("resource_missing"),
            format!("No such price: '{price_id}'"),
        )
        .with_param(describe_param(&price_path)));
    }
    let quantity_path = build_item_path(&index_text, &["quantity"]);
    let quantity = stripe_fields
        .positive_amount(&quantity_path)?
        .ok_or_else(|| StripeError::missing_param(&describe_param(&quantity_path)))?;
    let currency = read_currency(
        stripe_fields,
        &build_item_path(&index_text, &["price_data", "currency"]),
    )?;
    let unit_amount_path = build_item_path(&index_text, &["price_data", "unit_amount"]);
    let unit_amount_minor = stripe_fields
        .positive_amount(&unit_amount_path)?
        .ok_or_else(|| StripeError::missing_param(&describe_param(&unit_amount_path)))?;
    let name_path = build_item_path(&index_text, &["price_data", "product_data", "name"]);
    let name = stripe_fields
        .text(&name_path)
        .or_else(|| stripe_fields.text(&build_item_path(&index_text, &["price_data", "product"])))
        .ok_or_else(|| StripeError::missing_param(&describe_param(&name_path)))?;
    let line_item = PaymentLineItem {
        name,
        quantity: u32::try_from(quantity).unwrap_or(u32::MAX),
        unit_amount_minor,
    };
    Ok((line_item, currency))
}

/// Every line must share one currency, as Stripe requires in `payment` mode.
pub fn read_checkout_line_items(
    stripe_fields: &StripeFields,
) -> Result<CheckoutLineItems, StripeError> {
    let item_count = stripe_fields
        .find(&["line_items"])
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    if item_count == 0 {
        return Err(StripeError::missing_param("line_items"));
    }
    let mut line_items = Vec::with_capacity(item_count);
    let mut currencies = Vec::with_capacity(item_count);
    for item_index in 0..item_count {
        let (line_item, currency) = read_line_item(stripe_fields, item_index)?;
        line_items.push(line_item);
        currencies.push(currency);
    }
    let currency = currencies[0].clone();
    if currencies
        .iter()
        .any(|item_currency| *item_currency != currency)
    {
        return Err(StripeError::invalid_value(
            "line_items",
            "All line items must use the same currency.",
        ));
    }
    Ok(CheckoutLineItems {
        line_items,
        currency,
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn reads_price_data_lines_and_totals_them() {
        let stripe_fields = StripeFields::new(json!({
            "line_items": [
                {"quantity": "2", "price_data": {"currency": "usd", "unit_amount": "1500", "product_data": {"name": "T-shirt"}}},
                {"quantity": "1", "price_data": {"currency": "usd", "unit_amount": "500", "product": "prod_mug"}},
            ],
        }));

        let checkout_line_items = read_checkout_line_items(&stripe_fields);

        let Ok(checkout_line_items) = checkout_line_items else {
            panic!("the line items should be read");
        };
        assert_eq!(checkout_line_items.currency, "USD");
        assert_eq!(checkout_line_items.total_minor(), 3500);
        assert_eq!(checkout_line_items.line_items[1].name, "prod_mug");
    }

    #[test]
    fn refuses_price_ids_missing_quantities_and_mixed_currencies() {
        let price_line =
            StripeFields::new(json!({"line_items": [{"price": "price_123", "quantity": "1"}]}));
        let no_quantity = StripeFields::new(
            json!({"line_items": [{"price_data": {"currency": "usd", "unit_amount": "100", "product_data": {"name": "A"}}}]}),
        );

        assert_eq!(
            read_checkout_line_items(&price_line)
                .err()
                .map(|error| error.message),
            Some("No such price: 'price_123'".to_owned())
        );
        assert_eq!(
            read_checkout_line_items(&no_quantity).err(),
            Some(StripeError::missing_param("line_items[0][quantity]"))
        );
        assert_eq!(
            read_checkout_line_items(&StripeFields::default()).err(),
            Some(StripeError::missing_param("line_items"))
        );
    }
}
