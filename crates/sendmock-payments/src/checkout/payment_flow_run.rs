use crate::PaymentStepType;
use crate::method::{passes_luhn_check, to_card_digits, to_test_number};

/// A test card, number or voucher code with its outcome (`succeed`, `decline`, `three_ds`,
/// `succeed_then_dispute` or `wrong_pin`) and, for a decline, its reason.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TestValue {
    pub number: String,
    pub outcome: String,
    pub decline_reason: Option<String>,
}

/// What a method's flow checks the customer's entries against.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MethodTestValues {
    pub name: String,
    pub test_cards: Vec<TestValue>,
    pub test_numbers: Vec<TestValue>,
    pub otp: String,
    pub pin: String,
    /// `succeed` or `decline`, for flows without a deciding step.
    pub default_outcome: String,
    pub test_account: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CardEntry {
    pub number: String,
    pub exp_month: u32,
    pub exp_year: u32,
}

/// What the customer entered on the checkout page.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CheckoutEntries {
    pub card: Option<CardEntry>,
    pub number: Option<String>,
    pub otp: Option<String>,
    pub pin: Option<String>,
}

/// What the customer paid with, reduced to what is safe to keep.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PaidWith {
    Card {
        brand: String,
        last4: String,
        exp_month: u32,
        exp_year: u32,
    },
    Wallet {
        wallet_name: String,
        masked_number: String,
    },
    Bank {
        bank_name: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FlowOutcome {
    Succeed,
    SucceedThenDispute,
    ThreeDs,
    /// With the decline reason.
    Decline(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FlowRun {
    /// The page shows this and nothing is kept.
    Refused(String),
    Finished {
        outcome: FlowOutcome,
        paid_with: PaidWith,
    },
}

/// What one step found: a refusal, or the test value it decided and what was paid with.
#[derive(Default)]
struct StepVerdict {
    refusal: Option<String>,
    decided_value: Option<TestValue>,
    paid_with: Option<PaidWith>,
}

fn refuse(message: &str) -> StepVerdict {
    StepVerdict {
        refusal: Some(message.to_owned()),
        ..StepVerdict::default()
    }
}

pub fn read_card_brand(card_digits: &str) -> &'static str {
    let second_digit = card_digits.chars().nth(1);
    if card_digits.starts_with('4') {
        "visa"
    } else if card_digits.starts_with('5')
        && second_digit.is_some_and(|digit| ('1'..='5').contains(&digit))
    {
        "mastercard"
    } else if card_digits.starts_with('3') && matches!(second_digit, Some('4' | '7')) {
        "amex"
    } else {
        "card"
    }
}

/// A real card is refused before anything about it is kept.
fn check_card_form(values: &MethodTestValues, entries: &CheckoutEntries) -> StepVerdict {
    let Some(card_entry) = &entries.card else {
        return refuse("Enter a card");
    };
    let card_digits = to_card_digits(&card_entry.number);
    let Some(test_card) = values
        .test_cards
        .iter()
        .find(|test_card| test_card.number == card_digits)
    else {
        if passes_luhn_check(&card_digits) {
            return refuse("Use a test card: real card numbers are never accepted");
        }
        return refuse("Enter a valid card number");
    };
    StepVerdict {
        decided_value: Some(test_card.clone()),
        paid_with: Some(PaidWith::Card {
            brand: read_card_brand(&card_digits).to_owned(),
            last4: card_digits
                .chars()
                .skip(card_digits.len().saturating_sub(4))
                .collect(),
            exp_month: card_entry.exp_month,
            exp_year: card_entry.exp_year,
        }),
        refusal: None,
    }
}

fn check_test_number(
    values: &MethodTestValues,
    entries: &CheckoutEntries,
    is_voucher: bool,
) -> StepVerdict {
    let typed_number = to_test_number(entries.number.as_deref().unwrap_or_default());
    if typed_number.is_empty() {
        return refuse(if is_voucher {
            "Enter the voucher code"
        } else {
            "Enter the account number"
        });
    }
    let Some(test_number) = values
        .test_numbers
        .iter()
        .find(|test_number| to_test_number(&test_number.number) == typed_number)
    else {
        return refuse(if is_voucher {
            "Use one of the test voucher codes"
        } else {
            "Use one of the test numbers"
        });
    };
    let character_count = typed_number.chars().count();
    let ending = |kept: usize| -> String {
        typed_number
            .chars()
            .skip(character_count.saturating_sub(kept))
            .collect()
    };
    let masked_number = if is_voucher {
        format!("****{}", ending(4))
    } else {
        format!(
            "{}****{}",
            typed_number.chars().take(5).collect::<String>(),
            ending(2)
        )
    };
    StepVerdict {
        decided_value: Some(test_number.clone()),
        paid_with: Some(PaidWith::Wallet {
            wallet_name: values.name.clone(),
            masked_number,
        }),
        refusal: None,
    }
}

fn check_step(
    step_type: PaymentStepType,
    values: &MethodTestValues,
    entries: &CheckoutEntries,
    decided_so_far: Option<&TestValue>,
) -> StepVerdict {
    match step_type {
        PaymentStepType::CardForm => check_card_form(values, entries),
        PaymentStepType::AccountNumber => check_test_number(values, entries, false),
        PaymentStepType::VoucherCode => check_test_number(values, entries, true),
        PaymentStepType::Otp if entries.otp.as_deref() != Some(values.otp.as_str()) => {
            refuse("The verification code is wrong")
        }
        PaymentStepType::Pin
            if decided_so_far.is_some_and(|decided| decided.outcome == "wrong_pin")
                || entries.pin.as_deref() != Some(values.pin.as_str()) =>
        {
            refuse("Wrong PIN. Try again.")
        }
        PaymentStepType::SignedInAccount => StepVerdict {
            paid_with: Some(PaidWith::Wallet {
                wallet_name: values.name.clone(),
                masked_number: values.test_account.clone(),
            }),
            ..StepVerdict::default()
        },
        _ => StepVerdict::default(),
    }
}

fn read_outcome(values: &MethodTestValues, decided_value: Option<&TestValue>) -> FlowOutcome {
    let outcome = decided_value.map_or(values.default_outcome.as_str(), |decided| {
        decided.outcome.as_str()
    });
    match outcome {
        "decline" => FlowOutcome::Decline(
            decided_value
                .and_then(|decided| decided.decline_reason.clone())
                .unwrap_or_else(|| "generic_decline".to_owned()),
        ),
        "three_ds" => FlowOutcome::ThreeDs,
        "succeed_then_dispute" => FlowOutcome::SucceedThenDispute,
        _ => FlowOutcome::Succeed,
    }
}

/// Checks the entries against the method's test values one step at a time, in the flow's
/// order: the first refusal stops it, else the deciding step's test value (or the method's
/// default outcome) decides.
pub fn run_payment_flow(
    step_types: &[PaymentStepType],
    values: &MethodTestValues,
    entries: &CheckoutEntries,
) -> FlowRun {
    let mut decided_value: Option<TestValue> = None;
    let mut paid_with = PaidWith::Bank {
        bank_name: values.name.clone(),
    };
    for step_type in step_types {
        let step_verdict = check_step(*step_type, values, entries, decided_value.as_ref());
        if let Some(refusal) = step_verdict.refusal {
            return FlowRun::Refused(refusal);
        }
        decided_value = step_verdict.decided_value.or(decided_value);
        paid_with = step_verdict.paid_with.unwrap_or(paid_with);
    }
    FlowRun::Finished {
        outcome: read_outcome(values, decided_value.as_ref()),
        paid_with,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_value(number: &str, outcome: &str, decline_reason: Option<&str>) -> TestValue {
        TestValue {
            number: number.to_owned(),
            outcome: outcome.to_owned(),
            decline_reason: decline_reason.map(str::to_owned),
        }
    }

    fn wallet_values() -> MethodTestValues {
        MethodTestValues {
            name: "bKash".to_owned(),
            test_cards: vec![
                test_value("4242424242424242", "succeed", None),
                test_value("4000000000009995", "decline", Some("insufficient_funds")),
            ],
            test_numbers: vec![
                test_value("01770000001", "succeed", None),
                test_value("01770000003", "wrong_pin", None),
            ],
            otp: "123456".to_owned(),
            pin: "12121".to_owned(),
            default_outcome: "succeed".to_owned(),
            test_account: "buyer@example.com".to_owned(),
        }
    }

    fn card(number: &str) -> CheckoutEntries {
        CheckoutEntries {
            card: Some(CardEntry {
                number: number.to_owned(),
                exp_month: 12,
                exp_year: 2030,
            }),
            ..CheckoutEntries::default()
        }
    }

    const WALLET: [PaymentStepType; 3] = [
        PaymentStepType::AccountNumber,
        PaymentStepType::Otp,
        PaymentStepType::Pin,
    ];

    #[test]
    fn a_test_card_decides_and_keeps_only_brand_last4_and_expiry() {
        let run = run_payment_flow(
            &[PaymentStepType::CardForm],
            &wallet_values(),
            &card("4000 0000 0000 9995"),
        );
        assert_eq!(
            run,
            FlowRun::Finished {
                outcome: FlowOutcome::Decline("insufficient_funds".to_owned()),
                paid_with: PaidWith::Card {
                    brand: "visa".to_owned(),
                    last4: "9995".to_owned(),
                    exp_month: 12,
                    exp_year: 2030
                },
            }
        );
    }

    #[test]
    fn a_real_card_is_refused_and_an_invalid_one_named() {
        let real_card = run_payment_flow(
            &[PaymentStepType::CardForm],
            &wallet_values(),
            &card("4111 1111 1111 1111"),
        );
        assert_eq!(
            real_card,
            FlowRun::Refused("Use a test card: real card numbers are never accepted".to_owned())
        );
        let typo = run_payment_flow(
            &[PaymentStepType::CardForm],
            &wallet_values(),
            &card("4242 4242 4242 4241"),
        );
        assert_eq!(
            typo,
            FlowRun::Refused("Enter a valid card number".to_owned())
        );
    }

    #[test]
    fn a_wallet_runs_number_otp_and_pin_in_order() {
        let entries = |number: &str, otp: &str| CheckoutEntries {
            number: Some(number.to_owned()),
            otp: Some(otp.to_owned()),
            pin: Some("12121".to_owned()),
            card: None,
        };
        let paid = run_payment_flow(
            &WALLET,
            &wallet_values(),
            &entries("0177-000 0001", "123456"),
        );
        assert!(matches!(
            paid,
            FlowRun::Finished { outcome: FlowOutcome::Succeed, paid_with: PaidWith::Wallet { ref masked_number, .. } }
                if masked_number == "01770****01"
        ));
        assert_eq!(
            run_payment_flow(&WALLET, &wallet_values(), &entries("01770000001", "000000")),
            FlowRun::Refused("The verification code is wrong".to_owned())
        );
        assert_eq!(
            run_payment_flow(&WALLET, &wallet_values(), &entries("01770000003", "123456")),
            FlowRun::Refused("Wrong PIN. Try again.".to_owned())
        );
    }

    #[test]
    fn a_flow_without_a_deciding_step_takes_the_default_outcome() {
        let mut declining = wallet_values();
        declining.default_outcome = "decline".to_owned();
        let run = run_payment_flow(
            &[PaymentStepType::Confirm],
            &declining,
            &CheckoutEntries::default(),
        );
        assert_eq!(
            run,
            FlowRun::Finished {
                outcome: FlowOutcome::Decline("generic_decline".to_owned()),
                paid_with: PaidWith::Bank {
                    bank_name: "bKash".to_owned()
                },
            }
        );
    }
}
