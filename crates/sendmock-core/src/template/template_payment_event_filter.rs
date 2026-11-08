//! SendMock's payment and checkout events in a payment provider's own words, for the built-in
//! payment templates (`payment.succeeded` is Stripe's `payment_intent.succeeded` and PayPal's
//! `PAYMENT.CAPTURE.COMPLETED`).

use std::collections::BTreeMap;
use std::sync::LazyLock;

/// Exported from the mock's table (`web/src/lib/payments/payment-provider-event-names.ts`),
/// so the binary and the mock name events alike.
const PAYMENT_EVENT_NAMES_JSON: &str = include_str!("payment-event-names.json");

type ProviderEventNames = BTreeMap<String, BTreeMap<String, String>>;

static PAYMENT_EVENT_NAMES: LazyLock<ProviderEventNames> =
    LazyLock::new(|| serde_json::from_str(PAYMENT_EVENT_NAMES_JSON).unwrap_or_default());

/// `{{ event.type | payment_event("stripe") }}`: the provider's name for the event, or the
/// native name when the provider is unknown or has none for it.
pub fn payment_event_filter(event_type: String, provider: String) -> String {
    PAYMENT_EVENT_NAMES
        .get(&provider)
        .and_then(|provider_event_names| provider_event_names.get(&event_type))
        .cloned()
        .unwrap_or(event_type)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_an_event_as_each_provider_does() {
        let name_for = |event_type: &str, provider: &str| {
            payment_event_filter(event_type.to_owned(), provider.to_owned())
        };

        assert_eq!(
            name_for("payment.succeeded", "stripe"),
            "payment_intent.succeeded"
        );
        assert_eq!(
            name_for("payment.succeeded", "paypal"),
            "PAYMENT.CAPTURE.COMPLETED"
        );
        assert_eq!(name_for("payment.succeeded", "paypal_ipn"), "Completed");
        assert_eq!(name_for("payment.failed", "sslcommerz"), "FAILED");
        assert_eq!(
            name_for("payment.succeeded", "razorpay"),
            "payment.captured"
        );
        assert_eq!(name_for("payment.created", "razorpay"), "payment.created");
        assert_eq!(name_for("payment.succeeded", "nagad"), "payment.succeeded");
    }
}
