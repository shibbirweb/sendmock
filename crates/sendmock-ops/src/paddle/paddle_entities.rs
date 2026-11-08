use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

use crate::payments::{PaymentDetail, PaymentInstrument, PaymentLineItem, PaymentStatus};

pub const ADJUSTMENT_OBJECT_KIND: &str = "adjustment";

/// A refund as Paddle keeps it, by its `adj_` id.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PaddleAdjustment {
    pub transaction_id: String,
    pub reason: String,
    pub amount_minor: u64,
    pub is_full: bool,
    pub created_at: String,
}

/// The part of the transaction's id after `txn_`, which its items' ids reuse.
fn read_id_suffix(payment: &PaymentDetail) -> &str {
    read_transaction_id(payment).trim_start_matches("txn_")
}

pub fn read_transaction_id(payment: &PaymentDetail) -> &str {
    payment
        .provider_ids
        .get("transaction")
        .map_or("", String::as_str)
}

pub fn describe_item_id(payment: &PaymentDetail, item_index: usize) -> String {
    format!("txnitm_{}{item_index:02}", read_id_suffix(payment))
}

fn describe_money(amount_minor: u64, currency_code: &str) -> Value {
    json!({ "amount": amount_minor.to_string(), "currency_code": currency_code })
}

fn describe_totals(amount_minor: u64) -> Value {
    let amount_text = amount_minor.to_string();
    json!({ "subtotal": amount_text, "discount": "0", "tax": "0", "total": amount_text })
}

fn describe_price(
    payment: &PaymentDetail,
    item_index: usize,
    line_item: &PaymentLineItem,
) -> Value {
    json!({
        "id": format!("pri_{}{item_index:02}", read_id_suffix(payment)),
        "description": line_item.name,
        "name": line_item.name,
        "product_id": format!("pro_{}{item_index:02}", read_id_suffix(payment)),
        "billing_cycle": null,
        "trial_period": null,
        "tax_mode": "account_setting",
        "unit_price": describe_money(line_item.unit_amount_minor, &payment.summary.currency),
        "unit_price_overrides": [],
        "quantity": { "minimum": 1, "maximum": 100 },
        "status": "active",
        "custom_data": null,
        "import_meta": null,
        "created_at": payment.summary.created_at,
        "updated_at": payment.summary.created_at,
    })
}

fn describe_line_item(
    payment: &PaymentDetail,
    item_index: usize,
    line_item: &PaymentLineItem,
) -> Value {
    let line_total = line_item.unit_amount_minor * u64::from(line_item.quantity);
    json!({
        "id": describe_item_id(payment, item_index),
        "price_id": format!("pri_{}{item_index:02}", read_id_suffix(payment)),
        "quantity": line_item.quantity,
        "proration": null,
        "tax_rate": "0",
        "unit_totals": describe_totals(line_item.unit_amount_minor),
        "totals": describe_totals(line_total),
        "product": {
            "id": format!("pro_{}{item_index:02}", read_id_suffix(payment)),
            "name": line_item.name,
            "description": null,
            "type": "standard",
            "tax_category": "standard",
            "image_url": null,
            "custom_data": null,
            "status": "active",
            "import_meta": null,
            "created_at": payment.summary.created_at,
            "updated_at": payment.summary.created_at,
        },
    })
}

fn read_transaction_status(payment: &PaymentDetail) -> &'static str {
    match payment.summary.status {
        PaymentStatus::Succeeded
        | PaymentStatus::PartiallyRefunded
        | PaymentStatus::Refunded
        | PaymentStatus::Disputed => "completed",
        PaymentStatus::Canceled => "canceled",
        PaymentStatus::Authorized => "billed",
        _ => "ready",
    }
}

fn describe_payment_attempts(payment: &PaymentDetail) -> Vec<Value> {
    let attempt_status = match payment.summary.status {
        PaymentStatus::Failed => "error",
        PaymentStatus::RequiresPayment
        | PaymentStatus::RequiresAction
        | PaymentStatus::Canceled => return Vec::new(),
        _ => "captured",
    };
    let card = match &payment.method {
        Some(PaymentInstrument::Card {
            brand,
            last4,
            exp_month,
            exp_year,
        }) => json!({
            "type": brand, "last4": last4, "expiry_month": exp_month, "expiry_year": exp_year,
            "cardholder_name": payment.summary.customer_name,
        }),
        _ => Value::Null,
    };
    vec![json!({
        "payment_attempt_id": format!("{}-attempt", read_id_suffix(payment)),
        "stored_payment_method_id": format!("{}-method", read_id_suffix(payment)),
        "payment_method_id": null,
        "amount": payment.summary.amount_minor.to_string(),
        "status": attempt_status,
        "error_code": payment.summary.failure_code.as_ref().map(|_| "declined"),
        "method_details": { "type": "card", "card": card },
        "created_at": payment.summary.created_at,
        "captured_at": (attempt_status == "captured").then_some(&payment.summary.created_at),
    })]
}

fn describe_details(payment: &PaymentDetail) -> Value {
    let amount_minor = payment.summary.amount_minor;
    let currency_code = &payment.summary.currency;
    let mut transaction_totals = describe_totals(amount_minor);
    let extra_totals = json!({
        "grand_total": amount_minor.to_string(), "fee": null, "credit": "0", "credit_to_balance": "0",
        "balance": "0", "earnings": null, "currency_code": currency_code,
    });
    if let (Some(totals), Value::Object(extra)) = (transaction_totals.as_object_mut(), extra_totals)
    {
        totals.extend(extra);
    }
    let line_items: Vec<Value> = payment
        .line_items
        .iter()
        .enumerate()
        .map(|(item_index, line_item)| describe_line_item(payment, item_index, line_item))
        .collect();
    json!({
        "tax_rates_used": [{ "tax_rate": "0", "totals": describe_totals(amount_minor) }],
        "totals": transaction_totals,
        "adjusted_totals": {
            "subtotal": amount_minor.to_string(), "tax": "0", "total": amount_minor.to_string(),
            "grand_total": amount_minor.to_string(), "fee": "0", "earnings": "0", "currency_code": currency_code,
        },
        "payout_totals": null,
        "adjusted_payout_totals": null,
        "line_items": line_items,
    })
}

/// The transaction as the API and its webhooks answer it.
pub fn describe_transaction(payment: &PaymentDetail) -> Value {
    let items: Vec<Value> = payment
        .line_items
        .iter()
        .enumerate()
        .map(|(item_index, line_item)| {
            json!({ "price": describe_price(payment, item_index, line_item), "quantity": line_item.quantity, "proration": null })
        })
        .collect();
    let custom_data: Map<String, Value> = payment
        .metadata
        .iter()
        .map(|(data_name, data_value)| (data_name.clone(), Value::from(data_value.clone())))
        .collect();
    let transaction_status = read_transaction_status(payment);
    json!({
        "id": read_transaction_id(payment),
        "status": transaction_status,
        "customer_id": null, "address_id": null, "business_id": null,
        "custom_data": if custom_data.is_empty() { Value::Null } else { Value::Object(custom_data) },
        "origin": "api",
        "collection_mode": "automatic",
        "subscription_id": null, "invoice_id": null, "invoice_number": null,
        "billing_details": null, "billing_period": null,
        "currency_code": payment.summary.currency,
        "discount_id": null,
        "created_at": payment.summary.created_at,
        "updated_at": payment.summary.created_at,
        "billed_at": (transaction_status == "completed").then_some(&payment.summary.created_at),
        "revised_at": null,
        "items": items,
        "details": describe_details(payment),
        "payments": describe_payment_attempts(payment),
        "checkout": { "url": payment.checkout_url },
    })
}

pub fn describe_adjustment(
    adjustment_id: &str,
    paddle_adjustment: &PaddleAdjustment,
    payment: &PaymentDetail,
) -> Value {
    let amount_text = paddle_adjustment.amount_minor.to_string();
    json!({
        "id": adjustment_id,
        "action": "refund",
        "type": if paddle_adjustment.is_full { "full" } else { "partial" },
        "transaction_id": paddle_adjustment.transaction_id,
        "subscription_id": null,
        "customer_id": null,
        "reason": paddle_adjustment.reason,
        "credit_applied_to_balance": null,
        "currency_code": payment.summary.currency,
        "status": "approved",
        "items": [{
            "id": format!("adjitm_{}", adjustment_id.trim_start_matches("adj_")),
            "item_id": describe_item_id(payment, 0),
            "type": if paddle_adjustment.is_full { "full" } else { "partial" },
            "amount": amount_text,
            "proration": null,
            "totals": { "subtotal": amount_text, "tax": "0", "total": amount_text },
        }],
        "totals": {
            "subtotal": amount_text, "tax": "0", "total": amount_text, "fee": "0", "earnings": "0",
            "currency_code": payment.summary.currency,
        },
        "payout_totals": null,
        "created_at": paddle_adjustment.created_at,
        "updated_at": paddle_adjustment.created_at,
    })
}
