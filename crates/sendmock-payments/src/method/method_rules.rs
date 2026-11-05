use std::collections::HashSet;

use super::test_instruments::{
    is_test_card_range, passes_luhn_check, to_card_digits, to_test_number,
};
use crate::PaymentStepType;

/// A test number or voucher code with its outcome (`succeed`, `decline` or `wrong_pin`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TestNumberDraft {
    pub number: String,
    pub outcome: String,
}

/// A payment method as it is about to be saved.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentMethodDraft {
    pub key: String,
    pub name: String,
    pub accent: String,
    pub test_card_numbers: Vec<String>,
    pub test_numbers: Vec<TestNumberDraft>,
    pub otp: String,
    pub pin: String,
    pub test_account: String,
}

/// The first thing wrong with a method: the field and what to do about it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MethodProblem {
    pub field: String,
    pub message: String,
}

fn problem(field: &str, message: impl Into<String>) -> MethodProblem {
    MethodProblem {
        field: field.to_owned(),
        message: message.into(),
    }
}

fn is_definition_key(definition_key: &str) -> bool {
    let mut characters = definition_key.chars();
    (2..=32).contains(&definition_key.len())
        && characters
            .next()
            .is_some_and(|first| first.is_ascii_lowercase())
        && characters.all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '_'
        })
}

fn is_hex_colour(accent: &str) -> bool {
    accent.len() == 7
        && accent.starts_with('#')
        && accent[1..]
            .chars()
            .all(|character| character.is_ascii_hexdigit())
}

fn is_digits(text: &str, length_range: std::ops::RangeInclusive<usize>) -> bool {
    length_range.contains(&text.len()) && text.chars().all(|character| character.is_ascii_digit())
}

fn check_test_cards(test_card_numbers: &[String]) -> Result<(), MethodProblem> {
    if test_card_numbers.is_empty() {
        return Err(problem("test_cards", "Add at least one test card"));
    }
    let card_numbers: Vec<String> = test_card_numbers
        .iter()
        .map(|number| to_card_digits(number))
        .collect();
    if let Some(bad_number) = card_numbers
        .iter()
        .find(|card_digits| !passes_luhn_check(card_digits) || !is_test_card_range(card_digits))
    {
        return Err(problem(
            "test_cards",
            format!(
                "{bad_number} is not a test card: use a number from the test ranges (4242 4242 4242..., 4000 00..., 4000 02..., 5555 5555 5555...) that passes the Luhn check"
            ),
        ));
    }
    if card_numbers.iter().collect::<HashSet<_>>().len() != card_numbers.len() {
        return Err(problem("test_cards", "Each test card number appears once"));
    }
    Ok(())
}

fn check_test_numbers(
    test_numbers: &[TestNumberDraft],
    step_types: &[PaymentStepType],
) -> Result<(), MethodProblem> {
    let is_voucher = step_types.contains(&PaymentStepType::VoucherCode);
    let typed_numbers: Vec<String> = test_numbers
        .iter()
        .map(|test_number| to_test_number(&test_number.number))
        .collect();
    if typed_numbers.is_empty() {
        return Err(problem("test_numbers", "Add at least one test value"));
    }
    let fits_rule = |typed_number: &String| {
        if is_voucher {
            (4..=24).contains(&typed_number.len())
                && typed_number
                    .chars()
                    .all(|character| character.is_ascii_uppercase() || character.is_ascii_digit())
        } else {
            is_digits(typed_number, 8..=15)
        }
    };
    if !typed_numbers.iter().all(fits_rule) {
        let rule_message = if is_voucher {
            "Voucher codes are 4 to 24 letters or digits"
        } else {
            "Test numbers are 8 to 15 digits"
        };
        return Err(problem("test_numbers", rule_message));
    }
    let has_pin_step = step_types.contains(&PaymentStepType::Pin);
    if !has_pin_step
        && test_numbers
            .iter()
            .any(|test_number| test_number.outcome == "wrong_pin")
    {
        return Err(problem(
            "test_numbers",
            "Wrong PIN needs a PIN step in the flow",
        ));
    }
    if typed_numbers.iter().collect::<HashSet<_>>().len() != typed_numbers.len() {
        return Err(problem("test_numbers", "Each test value appears once"));
    }
    Ok(())
}

/// The rules the Methods screen and the API share; the test values checked are the ones the
/// method's flow asks for (`flow_step_types`, none when the flow does not exist).
pub fn check_payment_method(
    method_draft: &PaymentMethodDraft,
    existing_keys: &[String],
    is_new: bool,
    flow_step_types: Option<&[PaymentStepType]>,
) -> Result<(), MethodProblem> {
    if is_new && !is_definition_key(&method_draft.key) {
        return Err(problem(
            "key",
            "Use 2 to 32 lowercase letters, digits or _, starting with a letter",
        ));
    }
    if is_new && existing_keys.contains(&method_draft.key) {
        return Err(problem(
            "key",
            format!("A method with the key {} already exists", method_draft.key),
        ));
    }
    if method_draft.name.trim().is_empty() {
        return Err(problem("name", "Enter a name"));
    }
    if !is_hex_colour(&method_draft.accent) {
        return Err(problem("accent", "Use a colour like #e2136e"));
    }
    let Some(step_types) = flow_step_types else {
        return Err(problem("flow", "Pick a flow"));
    };
    if step_types.contains(&PaymentStepType::CardForm) {
        check_test_cards(&method_draft.test_card_numbers)?;
    }
    if step_types.contains(&PaymentStepType::AccountNumber)
        || step_types.contains(&PaymentStepType::VoucherCode)
    {
        check_test_numbers(&method_draft.test_numbers, step_types)?;
    }
    if step_types.contains(&PaymentStepType::Otp) && !is_digits(&method_draft.otp, 4..=8) {
        return Err(problem("otp", "Use 4 to 8 digits"));
    }
    if step_types.contains(&PaymentStepType::Pin) && !is_digits(&method_draft.pin, 4..=6) {
        return Err(problem("pin", "Use 4 to 6 digits"));
    }
    if step_types.contains(&PaymentStepType::SignedInAccount)
        && method_draft.test_account.trim().is_empty()
    {
        return Err(problem("test_account", "Enter the test account"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wallet_method() -> PaymentMethodDraft {
        PaymentMethodDraft {
            key: "upay".to_owned(),
            name: "Upay".to_owned(),
            accent: "#0a7cff".to_owned(),
            test_card_numbers: Vec::new(),
            test_numbers: vec![TestNumberDraft {
                number: "01770000001".to_owned(),
                outcome: "succeed".to_owned(),
            }],
            otp: "123456".to_owned(),
            pin: "12121".to_owned(),
            test_account: String::new(),
        }
    }

    const WALLET_STEPS: [PaymentStepType; 3] = [
        PaymentStepType::AccountNumber,
        PaymentStepType::Otp,
        PaymentStepType::Pin,
    ];

    fn field_of(
        method_draft: &PaymentMethodDraft,
        step_types: &[PaymentStepType],
    ) -> Option<String> {
        check_payment_method(method_draft, &["bkash".to_owned()], true, Some(step_types))
            .err()
            .map(|method_problem| method_problem.field)
    }

    #[test]
    fn checks_only_the_values_the_flow_asks_for() {
        assert_eq!(field_of(&wallet_method(), &WALLET_STEPS), None);
        let mut short_pin = wallet_method();
        short_pin.pin = "12".to_owned();
        assert_eq!(field_of(&short_pin, &WALLET_STEPS), Some("pin".to_owned()));
        assert_eq!(field_of(&short_pin, &[PaymentStepType::Confirm]), None);
    }

    #[test]
    fn refuses_a_real_card_as_a_test_card() {
        let mut card_method = wallet_method();
        card_method.test_card_numbers = vec!["4111 1111 1111 1111".to_owned()];
        let card_problem =
            check_payment_method(&card_method, &[], true, Some(&[PaymentStepType::CardForm])).err();
        assert!(
            card_problem.is_some_and(|method_problem| method_problem
                .message
                .contains("is not a test card"))
        );
    }

    #[test]
    fn needs_a_pin_step_for_a_wrong_pin_outcome_and_a_known_flow() {
        let mut wrong_pin = wallet_method();
        wrong_pin.test_numbers[0].outcome = "wrong_pin".to_owned();
        assert_eq!(
            field_of(&wrong_pin, &[PaymentStepType::AccountNumber]),
            Some("test_numbers".to_owned())
        );
        let problem_without_flow = check_payment_method(&wallet_method(), &[], true, None).err();
        assert_eq!(
            problem_without_flow.map(|method_problem| method_problem.field),
            Some("flow".to_owned())
        );
    }
}
