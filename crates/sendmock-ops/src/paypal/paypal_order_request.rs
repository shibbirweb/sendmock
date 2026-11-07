use std::collections::BTreeMap;

use serde_json::Value;

use super::paypal_amount::parse_amount;
use super::paypal_call::PAYPAL_PROVIDER_KEY;
use super::paypal_error::{PayPalApi, PayPalError};
use super::paypal_object_store::PayPalOrderState;
use crate::payments::{
    PaymentCaptureMethod, PaymentLineItem, ProviderCheckoutUrls, ProviderPaymentRequest,
};

const ORDERS: PayPalApi = PayPalApi::Orders;

/// A create-order request in the payment's terms, with what the order keeps beside it.
pub struct PayPalOrderRequest {
    pub payment_request: ProviderPaymentRequest,
    pub order_state: PayPalOrderState,
}

fn read_text(json_value: &Value, field_path: &[&str]) -> Option<String> {
    field_path
        .iter()
        .try_fold(json_value, |current_value, field_name| {
            current_value.get(field_name)
        })
        .and_then(Value::as_str)
        .map(str::to_owned)
}

fn check_intent(order_body: &Value) -> Result<(), PayPalError> {
    match order_body.get("intent").and_then(Value::as_str) {
        Some("CAPTURE") => Ok(()),
        None => Err(PayPalError::missing_field(ORDERS, "/intent")),
        Some(intent) => Err(PayPalError::invalid_request(
            ORDERS,
            "/intent",
            Some(intent),
            "INVALID_PARAMETER_VALUE",
            "The value of a field is invalid.",
        )),
    }
}

/// The one purchase unit served; more are refused.
fn read_purchase_unit(order_body: &Value) -> Result<&Value, PayPalError> {
    let purchase_units = order_body
        .get("purchase_units")
        .and_then(Value::as_array)
        .filter(|purchase_units| !purchase_units.is_empty())
        .ok_or_else(|| PayPalError::missing_field(ORDERS, "/purchase_units"))?;
    if purchase_units.len() > 1 {
        return Err(PayPalError::invalid_request(
            ORDERS,
            "/purchase_units/1",
            None,
            "INVALID_PARAMETER_VALUE",
            "SendMock emulates one purchase unit per order.",
        ));
    }
    Ok(&purchase_units[0])
}

fn read_line_items(
    purchase_unit: &Value,
    amount_minor: u64,
) -> Result<Vec<PaymentLineItem>, PayPalError> {
    let Some(items) = purchase_unit.get("items").and_then(Value::as_array) else {
        let item_name =
            read_text(purchase_unit, &["description"]).unwrap_or_else(|| "Order".to_owned());
        return Ok(vec![PaymentLineItem {
            name: item_name,
            quantity: 1,
            unit_amount_minor: amount_minor,
        }]);
    };
    items
        .iter()
        .enumerate()
        .map(|(item_index, item)| {
            let item_field = format!("/purchase_units/0/items/{item_index}");
            let (unit_amount_minor, _) = parse_amount(
                item.get("unit_amount").unwrap_or(&Value::Null),
                &format!("{item_field}/unit_amount"),
                ORDERS,
            )?;
            let quantity = read_text(item, &["quantity"])
                .and_then(|quantity_text| quantity_text.parse().ok())
                .unwrap_or(1);
            let name = read_text(item, &["name"])
                .ok_or_else(|| PayPalError::missing_field(ORDERS, &format!("{item_field}/name")))?;
            Ok(PaymentLineItem {
                name,
                quantity,
                unit_amount_minor,
            })
        })
        .collect()
}

/// `payment_source.paypal.experience_context`, else the older `application_context`.
fn read_checkout_urls(order_body: &Value) -> (ProviderCheckoutUrls, bool) {
    let experience_context = order_body
        .get("payment_source")
        .and_then(|payment_source| payment_source.get("paypal"))
        .and_then(|paypal_source| paypal_source.get("experience_context"));
    let has_payment_source = order_body.pointer("/payment_source/paypal").is_some();
    let url_source = experience_context
        .or_else(|| order_body.get("application_context"))
        .unwrap_or(&Value::Null);
    let checkout_urls = ProviderCheckoutUrls {
        success_url: read_text(url_source, &["return_url"]),
        cancel_url: read_text(url_source, &["cancel_url"]),
    };
    (checkout_urls, has_payment_source)
}

fn read_order_metadata(order_state: &PayPalOrderState) -> BTreeMap<String, String> {
    [
        ("custom_id", &order_state.custom_id),
        ("invoice_id", &order_state.invoice_id),
    ]
    .into_iter()
    .filter_map(|(field_name, field_value)| {
        field_value
            .clone()
            .map(|text| (field_name.to_owned(), text))
    })
    .collect()
}

/// Reads `POST /v2/checkout/orders` as PayPal checks it.
pub fn read_order_request(order_body: &Value) -> Result<PayPalOrderRequest, PayPalError> {
    if !order_body.is_object() {
        return Err(PayPalError::malformed_json(ORDERS));
    }
    check_intent(order_body)?;
    let purchase_unit = read_purchase_unit(order_body)?;
    let (amount_minor, currency) = parse_amount(
        purchase_unit.get("amount").unwrap_or(&Value::Null),
        "/purchase_units/0/amount",
        ORDERS,
    )?;
    let (checkout_urls, has_payment_source) = read_checkout_urls(order_body);
    let order_state = PayPalOrderState {
        reference_id: read_text(purchase_unit, &["reference_id"]),
        description: read_text(purchase_unit, &["description"]),
        custom_id: read_text(purchase_unit, &["custom_id"]),
        invoice_id: read_text(purchase_unit, &["invoice_id"]),
        has_payment_source,
    };
    let customer_email = read_text(order_body, &["payment_source", "paypal", "email_address"])
        .or_else(|| read_text(order_body, &["payer", "email_address"]));
    Ok(PayPalOrderRequest {
        payment_request: ProviderPaymentRequest {
            provider: PAYPAL_PROVIDER_KEY.to_owned(),
            amount_minor,
            currency,
            customer_email,
            line_items: read_line_items(purchase_unit, amount_minor)?,
            metadata: read_order_metadata(&order_state),
            capture_method: PaymentCaptureMethod::Manual,
            checkout: Some(checkout_urls),
        },
        order_state,
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn build_order_body() -> Value {
        json!({
            "intent": "CAPTURE",
            "purchase_units": [{
                "reference_id": "order-7",
                "custom_id": "cust-7",
                "amount": {"currency_code": "USD", "value": "25.00"},
            }],
            "payment_source": {"paypal": {"experience_context": {
                "return_url": "https://shop.example/return",
                "cancel_url": "https://shop.example/cancel",
            }}},
        })
    }

    #[test]
    fn an_order_is_a_manual_capture_payment_with_its_urls() {
        let order_request = read_order_request(&build_order_body())
            .unwrap_or_else(|paypal_error| panic!("{paypal_error:?}"));

        let payment_request = order_request.payment_request;
        assert_eq!(payment_request.amount_minor, 2500);
        assert_eq!(payment_request.capture_method, PaymentCaptureMethod::Manual);
        assert_eq!(
            payment_request
                .checkout
                .and_then(|checkout_urls| checkout_urls.success_url)
                .as_deref(),
            Some("https://shop.example/return")
        );
        assert_eq!(payment_request.metadata["custom_id"], "cust-7");
        assert!(order_request.order_state.has_payment_source);
    }

    #[test]
    fn authorize_intent_and_a_second_purchase_unit_are_refused() {
        let mut authorize_body = build_order_body();
        authorize_body["intent"] = json!("AUTHORIZE");
        let mut two_units_body = build_order_body();
        two_units_body["purchase_units"] = json!([{}, {}]);

        let refused_issue = |order_body: &Value| {
            read_order_request(order_body)
                .err()
                .map(|paypal_error| paypal_error.body["details"][0]["field"].clone())
        };

        assert_eq!(refused_issue(&authorize_body), Some(json!("/intent")));
        assert_eq!(
            refused_issue(&two_units_body),
            Some(json!("/purchase_units/1"))
        );
    }
}
