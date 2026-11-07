use std::collections::BTreeMap;

use crate::payments::{
    PaymentCaptureMethod, PaymentDetail, PaymentInstrument, PaymentStatus, PaymentSummary,
    PaymentTimelineEvent,
};

/// A Checkout Session paid with `pm_card_visa`, as the Stripe object builders' tests start.
pub fn build_paid_stripe_payment() -> PaymentDetail {
    PaymentDetail {
        summary: PaymentSummary {
            id: "01JPAYMENT0000000000000000".to_owned(),
            provider: "stripe".to_owned(),
            provider_name: "Stripe".to_owned(),
            provider_reference: "cs_test_3PaidIntent".to_owned(),
            amount_minor: 2000,
            currency: "USD".to_owned(),
            status: PaymentStatus::Succeeded,
            customer_email: Some("buyer@example.com".to_owned()),
            customer_name: None,
            failure_code: None,
            refunded_minor: 0,
            created_at: "2026-11-05T10:00:00Z".to_owned(),
        },
        provider_ids: BTreeMap::from([
            (
                "checkout_session".to_owned(),
                "cs_test_3PaidIntent".to_owned(),
            ),
            ("payment_intent".to_owned(), "pi_3PaidIntent".to_owned()),
        ]),
        customer_phone: None,
        method: Some(PaymentInstrument::Card {
            brand: "visa".to_owned(),
            last4: "4242".to_owned(),
            exp_month: 12,
            exp_year: 2034,
        }),
        line_items: Vec::new(),
        metadata: BTreeMap::from([("order_id".to_owned(), "1001".to_owned())]),
        success_url: Some("https://shop.example/success".to_owned()),
        fail_url: None,
        cancel_url: Some("https://shop.example/cancel".to_owned()),
        checkout_url: None,
        redirect: None,
        captured_minor: 2000,
        capture_method: PaymentCaptureMethod::Automatic,
        method_key: Some("card".to_owned()),
        dispute: None,
        timeline: vec![PaymentTimelineEvent {
            kind: "succeeded".to_owned(),
            description: "Paid".to_owned(),
            created_at: "2026-11-05T10:01:00Z".to_owned(),
        }],
        notifications: Vec::new(),
    }
}
