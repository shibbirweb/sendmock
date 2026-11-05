/// Stripe's test PaymentMethods and tokens with the test card each stands for, as Stripe's
/// testing docs list them. Apps send these from the server, never a card number.
const STRIPE_TEST_PAYMENT_METHODS: &[(&str, &str)] = &[
    ("pm_card_visa", "4242424242424242"),
    ("tok_visa", "4242424242424242"),
    ("pm_card_mastercard", "5555555555554444"),
    ("tok_mastercard", "5555555555554444"),
    ("pm_card_visa_chargeDeclined", "4000000000000002"),
    ("pm_card_chargeDeclined", "4000000000000002"),
    ("tok_chargeDeclined", "4000000000000002"),
    (
        "pm_card_visa_chargeDeclinedInsufficientFunds",
        "4000000000009995",
    ),
    (
        "pm_card_chargeDeclinedInsufficientFunds",
        "4000000000009995",
    ),
    ("tok_chargeDeclinedInsufficientFunds", "4000000000009995"),
    ("pm_card_chargeDeclinedExpiredCard", "4000000000000069"),
    ("tok_chargeDeclinedExpiredCard", "4000000000000069"),
    ("pm_card_chargeDeclinedIncorrectCvc", "4000000000000127"),
    ("tok_chargeDeclinedIncorrectCvc", "4000000000000127"),
    ("pm_card_authenticationRequiredOnSetup", "4000002500003155"),
    ("pm_card_createDispute", "4000000000000259"),
    ("tok_createDispute", "4000000000000259"),
];

/// The test card number behind a Stripe test PaymentMethod or token, e.g. `pm_card_visa`.
pub fn find_stripe_test_card_number(payment_method_id: &str) -> Option<&'static str> {
    STRIPE_TEST_PAYMENT_METHODS
        .iter()
        .find(|(test_payment_method, _)| *test_payment_method == payment_method_id)
        .map(|(_, card_number)| *card_number)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_stripe_test_payment_methods_to_their_documented_cards() {
        assert_eq!(
            find_stripe_test_card_number("pm_card_visa"),
            Some("4242424242424242")
        );
        assert_eq!(
            find_stripe_test_card_number("tok_chargeDeclinedInsufficientFunds"),
            Some("4000000000009995")
        );
        assert_eq!(
            find_stripe_test_card_number("pm_card_authenticationRequiredOnSetup"),
            Some("4000002500003155")
        );
        assert_eq!(find_stripe_test_card_number("pm_1NotATestMethod"), None);
    }
}
