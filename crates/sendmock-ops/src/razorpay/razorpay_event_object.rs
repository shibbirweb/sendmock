use sendmock_payments::sign_razorpay_payload;
use sendmock_store::PaymentProviderObjectRecord;
use serde_json::{Map, Value, json};

use super::razorpay_entities::{
    REFUND_OBJECT_KIND, RazorpayRefund, describe_order, describe_payment, describe_refund,
    read_order_id, read_payment_entity_id, read_unix_seconds,
};
use crate::payments::{PaymentDetail, PaymentGatewayFields, list_kept_or_stored_objects};
use crate::{OperationContext, OperationError};

fn read_key_secret(gateway_fields: &PaymentGatewayFields) -> &str {
    gateway_fields
        .credentials
        .iter()
        .find(|credential| credential.name == "key_secret")
        .map_or("", |credential| credential.value.as_str())
}

/// What Checkout hands the app's `callback_url`: the ids and `razorpay_signature`, the
/// HMAC-SHA256 of `order_id|payment_id` keyed by the key secret.
pub fn describe_razorpay_redirect_object(
    gateway_fields: &PaymentGatewayFields,
    payment: &PaymentDetail,
) -> Map<String, Value> {
    let order_id = read_order_id(payment);
    let payment_id = read_payment_entity_id(payment);
    let checkout_signature = sign_razorpay_payload(
        read_key_secret(gateway_fields),
        &format!("{order_id}|{payment_id}"),
    );
    let mut redirect_object = Map::new();
    redirect_object.insert("razorpay_payment_id".to_owned(), Value::from(payment_id));
    redirect_object.insert("razorpay_order_id".to_owned(), Value::from(order_id));
    redirect_object.insert(
        "razorpay_signature".to_owned(),
        Value::from(checkout_signature),
    );
    redirect_object
}

/// The refund the event is about: the newest Razorpay refund, else one standing for the
/// refunds made through Simulate.
async fn describe_latest_refund(
    operation_context: &OperationContext,
    payment: &PaymentDetail,
    kept_provider_objects: &[PaymentProviderObjectRecord],
) -> Result<Value, OperationError> {
    let refunds: Vec<(String, RazorpayRefund)> = list_kept_or_stored_objects(
        operation_context,
        kept_provider_objects,
        &payment.summary.id,
        REFUND_OBJECT_KIND,
    )
    .await?;
    if let Some((refund_id, razorpay_refund)) = refunds.last() {
        return Ok(describe_refund(
            refund_id,
            razorpay_refund,
            &payment.summary.currency,
        ));
    }
    let standing_refund = RazorpayRefund {
        payment_id: read_payment_entity_id(payment).to_owned(),
        amount_minor: payment.summary.refunded_minor,
        created_at_unix_ms: operation_context.clock.now_unix_ms(),
        ..RazorpayRefund::default()
    };
    let refund_id = format!(
        "rfnd_{}",
        read_order_id(payment).trim_start_matches("order_")
    );
    Ok(describe_refund(
        &refund_id,
        &standing_refund,
        &payment.summary.currency,
    ))
}

fn describe_dispute(payment: &PaymentDetail, event_name: &str) -> Value {
    let dispute_status = event_name
        .rsplit('.')
        .next()
        .filter(|status| *status != "created")
        .unwrap_or("open");
    json!({
        "id": format!("disp_{}", read_order_id(payment).trim_start_matches("order_")),
        "entity": "dispute",
        "payment_id": read_payment_entity_id(payment),
        "amount": payment.summary.amount_minor,
        "currency": payment.summary.currency,
        "amount_deducted": 0,
        "reason_code": "chargeback",
        "status": dispute_status,
        "phase": "chargeback",
        "created_at": read_unix_seconds(&payment.summary.created_at),
    })
}

/// A webhook's `contains` and `payload` for the event, as Razorpay's payloads nest each
/// entity, with the Checkout fields its redirect reads.
pub async fn describe_razorpay_event_object(
    operation_context: &OperationContext,
    gateway_fields: &PaymentGatewayFields,
    payment: &PaymentDetail,
    event_name: &str,
    kept_provider_objects: &[PaymentProviderObjectRecord],
) -> Result<Value, OperationError> {
    let mut payload = Map::new();
    payload.insert(
        "payment".to_owned(),
        json!({ "entity": describe_payment(payment) }),
    );
    let extra_entity = if event_name.starts_with("refund.") {
        Some((
            "refund",
            describe_latest_refund(operation_context, payment, kept_provider_objects).await?,
        ))
    } else if event_name.starts_with("order.") {
        Some(("order", describe_order(payment)))
    } else if event_name.starts_with("payment.dispute.") {
        Some(("dispute", describe_dispute(payment, event_name)))
    } else {
        None
    };
    let mut contains = vec![Value::from("payment")];
    if let Some((entity_name, entity)) = extra_entity {
        payload.insert(entity_name.to_owned(), json!({ "entity": entity }));
        if entity_name == "refund" {
            contains.insert(0, Value::from(entity_name));
        } else {
            contains.push(Value::from(entity_name));
        }
    }
    let mut event_object = describe_razorpay_redirect_object(gateway_fields, payment);
    event_object.insert("contains".to_owned(), Value::from(contains));
    event_object.insert("payload".to_owned(), Value::Object(payload));
    Ok(Value::Object(event_object))
}
