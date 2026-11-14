use serde_json::{Map, Value, json};

use super::paypal_amount::describe_amount;
use super::paypal_capture_object::{describe_capture, describe_refund};
use super::paypal_object_store::{PayPalPaymentObjects, read_order_id};
use crate::payments::{PaymentDetail, PaymentStatus};

/// The sandbox buyer every approval on the checkout page is made as.
const TEST_PAYER_ID: &str = "TESTPAYER01";
const TEST_PAYER_EMAIL: &str = "sb-buyer@personal.example.com";

/// The order's status for the payment's: approved on the page is the payment authorized, and a
/// decline on the page is only found at capture, as with PayPal.
pub fn read_order_status(payment: &PaymentDetail, has_payment_source: bool) -> &'static str {
    match payment.summary.status {
        PaymentStatus::RequiresPayment | PaymentStatus::RequiresAction if has_payment_source => {
            "PAYER_ACTION_REQUIRED"
        }
        PaymentStatus::RequiresPayment | PaymentStatus::RequiresAction => "CREATED",
        PaymentStatus::Authorized | PaymentStatus::Failed => "APPROVED",
        PaymentStatus::Canceled => "VOIDED",
        PaymentStatus::Succeeded
        | PaymentStatus::Refunded
        | PaymentStatus::PartiallyRefunded
        | PaymentStatus::Disputed => "COMPLETED",
    }
}

fn is_approved(payment: &PaymentDetail) -> bool {
    payment.method.is_some()
}

fn describe_payer_name(payment: &PaymentDetail) -> Value {
    let full_name = payment
        .summary
        .customer_name
        .as_deref()
        .unwrap_or("Test Buyer");
    let (given_name, surname) = full_name.split_once(' ').unwrap_or((full_name, ""));
    json!({"given_name": given_name, "surname": surname})
}

fn read_payer_email(payment: &PaymentDetail) -> &str {
    payment
        .summary
        .customer_email
        .as_deref()
        .unwrap_or(TEST_PAYER_EMAIL)
}

fn describe_payer(payment: &PaymentDetail) -> Value {
    json!({
        "name": describe_payer_name(payment),
        "email_address": read_payer_email(payment),
        "payer_id": TEST_PAYER_ID,
        "address": {"country_code": "US"},
    })
}

fn describe_payment_source(payment: &PaymentDetail) -> Value {
    if !is_approved(payment) {
        return json!({"paypal": {}});
    }
    json!({"paypal": {
        "email_address": read_payer_email(payment),
        "account_id": TEST_PAYER_ID,
        "account_status": "VERIFIED",
        "name": describe_payer_name(payment),
        "address": {"country_code": "US"},
    }})
}

/// The order's links for its status: the payer's page while it waits for approval, capture
/// while it can be captured.
pub fn describe_order_links(
    api_base_url: &str,
    http_address: &str,
    payment: &PaymentDetail,
    order_status: &str,
) -> Value {
    let order_url = format!(
        "{api_base_url}/v2/checkout/orders/{}",
        read_order_id(payment)
    );
    let mut links = vec![json!({"href": order_url, "rel": "self", "method": "GET"})];
    let approve_rel = match order_status {
        "PAYER_ACTION_REQUIRED" => Some("payer-action"),
        "CREATED" => Some("approve"),
        _ => None,
    };
    if let Some(approve_rel) = approve_rel {
        let page_url = format!("http://{http_address}/pay/{}", payment.summary.id);
        links.push(json!({"href": page_url, "rel": approve_rel, "method": "GET"}));
    }
    if matches!(
        order_status,
        "CREATED" | "PAYER_ACTION_REQUIRED" | "APPROVED"
    ) {
        links.push(json!({"href": order_url, "rel": "update", "method": "PATCH"}));
        links.push(
            json!({"href": format!("{order_url}/capture"), "rel": "capture", "method": "POST"}),
        );
    }
    Value::Array(links)
}

fn describe_items(payment: &PaymentDetail) -> Value {
    let currency = &payment.summary.currency;
    payment
        .line_items
        .iter()
        .map(|line_item| {
            json!({
                "name": line_item.name,
                "quantity": line_item.quantity.to_string(),
                "unit_amount": describe_amount(line_item.unit_amount_minor, currency),
            })
        })
        .collect()
}

fn describe_purchase_unit(
    api_base_url: &str,
    payment: &PaymentDetail,
    paypal_objects: &PayPalPaymentObjects,
) -> Value {
    let order_state = &paypal_objects.order_state;
    let currency = &payment.summary.currency;
    let mut amount = describe_amount(payment.summary.amount_minor, currency);
    amount["breakdown"] =
        json!({"item_total": describe_amount(payment.summary.amount_minor, currency)});
    let mut purchase_unit = json!({
        "reference_id": order_state.reference_id.as_deref().unwrap_or("default"),
        "amount": amount,
        "payee": {"email_address": "merchant@business.example.com", "merchant_id": "SENDMOCKMERCHANT"},
        "description": order_state.description,
        "custom_id": order_state.custom_id,
        "invoice_id": order_state.invoice_id,
        "items": describe_items(payment),
    });
    if !paypal_objects.captures.is_empty() {
        let captures: Vec<Value> = paypal_objects
            .captures
            .iter()
            .map(|(capture_id, capture_state)| {
                describe_capture(
                    api_base_url,
                    payment,
                    order_state,
                    (capture_id, capture_state),
                )
            })
            .collect();
        let refunds: Vec<Value> = paypal_objects
            .refunds
            .iter()
            .map(|(refund_id, refund_state)| {
                describe_refund(api_base_url, (refund_id, refund_state), true)
            })
            .collect();
        let mut payments = Map::from_iter([("captures".to_owned(), Value::Array(captures))]);
        if !refunds.is_empty() {
            payments.insert("refunds".to_owned(), Value::Array(refunds));
        }
        purchase_unit["payments"] = Value::Object(payments);
    }
    purchase_unit
}

/// Where the order's API and its page are served.
pub struct OrderAddresses<'address> {
    pub api_base_url: &'address str,
    pub http_address: &'address str,
}

/// The whole order, as `GET /v2/checkout/orders/{id}` and `Prefer: return=representation`
/// answer it.
pub fn describe_order(
    addresses: &OrderAddresses<'_>,
    payment: &PaymentDetail,
    paypal_objects: &PayPalPaymentObjects,
) -> Value {
    let order_status = read_order_status(payment, paypal_objects.order_state.has_payment_source);
    let mut order = json!({
        "id": read_order_id(payment),
        "intent": "CAPTURE",
        "status": order_status,
        "purchase_units": [describe_purchase_unit(addresses.api_base_url, payment, paypal_objects)],
        "create_time": payment.summary.created_at,
        "links": describe_order_links(addresses.api_base_url, addresses.http_address, payment, order_status),
    });
    if is_approved(payment) || paypal_objects.order_state.has_payment_source {
        order["payment_source"] = describe_payment_source(payment);
    }
    if is_approved(payment) {
        order["payer"] = describe_payer(payment);
    }
    order
}

/// The order as `return=minimal` answers a create: id, status and links.
pub fn describe_minimal_order(
    addresses: &OrderAddresses<'_>,
    payment: &PaymentDetail,
    has_payment_source: bool,
) -> Value {
    let order_status = read_order_status(payment, has_payment_source);
    let mut order = json!({
        "id": read_order_id(payment),
        "status": order_status,
        "links": describe_order_links(addresses.api_base_url, addresses.http_address, payment, order_status),
    });
    if has_payment_source {
        order["payment_source"] = describe_payment_source(payment);
    }
    order
}
