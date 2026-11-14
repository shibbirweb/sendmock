/// How Stripe reports a declined card: the error's `code`, its `decline_code` (Stripe's docs
/// list none for an expired card or a wrong CVC) and the message shown to the customer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StripeCardDecline {
    pub code: &'static str,
    pub decline_code: Option<&'static str>,
    pub message: &'static str,
}

/// Stripe's error for a decline reason of the test card table; a failed 3-D Secure challenge
/// is `payment_intent_authentication_failure`, as Stripe answers it.
pub fn describe_stripe_card_decline(decline_reason: &str) -> StripeCardDecline {
    let declined = |decline_code, message| StripeCardDecline {
        code: "card_declined",
        decline_code: Some(decline_code),
        message,
    };
    match decline_reason {
        "insufficient_funds" => declined("insufficient_funds", "Your card has insufficient funds."),
        "fraudulent" => declined("fraudulent", "Your card was declined."),
        "expired_card" => StripeCardDecline {
            code: "expired_card",
            decline_code: None,
            message: "Your card has expired.",
        },
        "incorrect_cvc" => StripeCardDecline {
            code: "incorrect_cvc",
            decline_code: None,
            message: "Your card's security code is incorrect.",
        },
        "authentication_failed" => StripeCardDecline {
            code: "payment_intent_authentication_failure",
            decline_code: None,
            message: "The provided PaymentMethod has failed authentication. You can provide payment_method_data or a new PaymentMethod to attempt to fulfill this PaymentIntent again.",
        },
        _ => declined("generic_decline", "Your card was declined."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_each_decline_as_stripe_does() {
        assert_eq!(
            describe_stripe_card_decline("insufficient_funds"),
            StripeCardDecline {
                code: "card_declined",
                decline_code: Some("insufficient_funds"),
                message: "Your card has insufficient funds.",
            }
        );
        assert_eq!(
            describe_stripe_card_decline("expired_card").code,
            "expired_card"
        );
        assert_eq!(
            describe_stripe_card_decline("incorrect_cvc").decline_code,
            None
        );
        assert_eq!(
            describe_stripe_card_decline("generic_decline").decline_code,
            Some("generic_decline")
        );
    }
}
