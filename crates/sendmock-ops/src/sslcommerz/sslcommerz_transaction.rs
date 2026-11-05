use sendmock_core::{format_rfc3339, parse_rfc3339};
use sendmock_payments::format_major_amount;
use serde_json::{Map, Value};

use crate::payments::{PaymentDetail, PaymentInstrument, PaymentStatus};

/// SSLCommerz writes its times in Dhaka, six hours ahead of UTC with no daylight saving.
const DHAKA_OFFSET_MS: i64 = 6 * 3_600_000;
const PASSED_ON_FIELDS: [&str; 4] = ["value_a", "value_b", "value_c", "value_d"];
/// The timeline entries that close a checkout, whose time is the transaction's.
const CLOSING_TIMELINE_KINDS: [&str; 3] = ["succeeded", "failed", "canceled"];

/// `YYYY-MM-DD HH:MM:SS` in Dhaka, as SSLCommerz writes `tran_date`.
pub fn format_dhaka_time(timestamp_text: &str) -> String {
    let unix_ms = parse_rfc3339(timestamp_text).unwrap_or_default();
    format_rfc3339(unix_ms + DHAKA_OFFSET_MS)
        .chars()
        .take(19)
        .collect::<String>()
        .replace('T', " ")
}

/// Whether the payment went through, so it has a `val_id` to validate.
pub fn is_paid(payment: &PaymentDetail) -> bool {
    matches!(
        payment.summary.status,
        PaymentStatus::Succeeded
            | PaymentStatus::Refunded
            | PaymentStatus::PartiallyRefunded
            | PaymentStatus::Disputed
    )
}

pub fn read_provider_id(payment: &PaymentDetail, id_name: &str) -> String {
    payment
        .provider_ids
        .get(id_name)
        .cloned()
        .unwrap_or_default()
}

/// The bank's own transaction id, which refunds name the transaction by; payments made before
/// it was kept get one made from the payment's id.
pub fn read_bank_tran_id(payment: &PaymentDetail) -> String {
    payment
        .provider_ids
        .get("bank_tran_id")
        .cloned()
        .unwrap_or_else(|| derive_bank_tran_id(payment))
}

fn derive_bank_tran_id(payment: &PaymentDetail) -> String {
    let compact_date: String = format_dhaka_time(&payment.summary.created_at)
        .chars()
        .filter(char::is_ascii_digit)
        .skip(2)
        .collect();
    let payment_suffix: String = payment
        .summary
        .id
        .chars()
        .skip(payment.summary.id.len().saturating_sub(10))
        .collect();
    format!("{compact_date}{payment_suffix}")
}

fn read_transaction_time(payment: &PaymentDetail) -> String {
    let closing_time = payment
        .timeline
        .iter()
        .rev()
        .find(|timeline_event| CLOSING_TIMELINE_KINDS.contains(&timeline_event.kind.as_str()))
        .map_or(&payment.summary.created_at, |timeline_event| {
            &timeline_event.created_at
        });
    format_dhaka_time(closing_time)
}

/// `card_type`, `card_no`, `card_issuer` and `card_brand` for the way the customer paid.
fn describe_instrument(payment: &PaymentDetail) -> [String; 4] {
    let method_key = payment
        .method_key
        .as_deref()
        .unwrap_or_default()
        .to_ascii_uppercase();
    match &payment.method {
        Some(PaymentInstrument::Card { brand, last4, .. }) => {
            let card_brand = brand.to_ascii_uppercase();
            [
                format!("{card_brand}-SendMock Test Bank"),
                format!("XXXXXXXXXXXX{last4}"),
                "SENDMOCK TEST BANK".to_owned(),
                card_brand,
            ]
        }
        Some(PaymentInstrument::Wallet {
            wallet_name,
            masked_number,
        }) => [
            format!("{method_key}-{wallet_name}"),
            masked_number.clone(),
            format!("{wallet_name} Mobile Banking"),
            "MOBILEBANKING".to_owned(),
        ],
        Some(PaymentInstrument::Bank { bank_name }) => [
            format!("{method_key}-{bank_name}"),
            String::new(),
            bank_name.clone(),
            "IB".to_owned(),
        ],
        None => Default::default(),
    }
}

/// The transaction as SSLCommerz posts it in the IPN and the redirects and answers it from
/// the validation API, with `verify_key` naming every field; `transaction_status` is
/// SSLCommerz's word for it (`VALID`, `FAILED`, `CANCELLED`, ...).
pub fn describe_sslcommerz_transaction(
    payment: &PaymentDetail,
    transaction_status: &str,
) -> Map<String, Value> {
    let summary = &payment.summary;
    let amount = format_major_amount(summary.amount_minor, &summary.currency);
    let val_id = if is_paid(payment) {
        read_provider_id(payment, "val_id")
    } else {
        String::new()
    };
    let [card_type, card_no, card_issuer, card_brand] = describe_instrument(payment);
    let mut field_texts = vec![
        ("status", transaction_status.to_owned()),
        ("tran_date", read_transaction_time(payment)),
        ("tran_id", summary.provider_reference.clone()),
        ("val_id", val_id),
        ("amount", amount.clone()),
        ("store_amount", amount.clone()),
        ("currency", summary.currency.clone()),
        ("bank_tran_id", read_bank_tran_id(payment)),
        ("card_type", card_type),
        ("card_no", card_no),
        ("card_issuer", card_issuer),
        ("card_brand", card_brand),
        ("card_issuer_country", "Bangladesh".to_owned()),
        ("card_issuer_country_code", "BD".to_owned()),
        ("currency_type", summary.currency.clone()),
        ("currency_amount", amount),
        ("currency_rate", "1.0000".to_owned()),
        ("base_fair", "0.00".to_owned()),
    ];
    for passed_on_field in PASSED_ON_FIELDS {
        let passed_on_value = payment
            .metadata
            .get(passed_on_field)
            .cloned()
            .unwrap_or_default();
        field_texts.push((passed_on_field, passed_on_value));
    }
    field_texts.push(("risk_level", "0".to_owned()));
    field_texts.push(("risk_title", "Safe".to_owned()));
    let verify_key = field_texts
        .iter()
        .map(|(field_name, _)| *field_name)
        .collect::<Vec<_>>()
        .join(",");
    field_texts.push(("verify_key", verify_key));
    field_texts
        .into_iter()
        .map(|(field_name, field_text)| (field_name.to_owned(), Value::from(field_text)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tran_date_is_written_in_dhaka_time() {
        assert_eq!(
            format_dhaka_time("2026-11-05T20:15:30.250Z"),
            "2026-11-06 02:15:30"
        );
    }
}
