use std::collections::BTreeMap;

use sendmock_payments::{
    CardEntry, CheckoutEntries, FlowOutcome, FlowRun, MethodTestValues, PaidWith, PaymentStepType,
    TestValue, run_payment_flow,
};
use serde::Serialize;

use super::checkout_completion_views::CheckoutCompleteRequest;
use super::payment_change::PaymentChange;
use super::payment_flow_catalogue::load_payment_flows;
use super::payment_method_catalogue::load_payment_methods;
use super::payment_method_views::PaymentMethodFields;
use super::payment_views::PaymentInstrument;
use crate::{OperationContext, OperationError};

fn refuse_payment(message: impl Into<String>) -> OperationError {
    OperationError::Unprocessable {
        code: "validation_failed",
        message: message.into(),
    }
}

/// An outcome or reason as its wire name, e.g. `three_ds`.
pub fn to_wire_name(wire_value: impl Serialize) -> String {
    serde_json::to_value(wire_value)
        .ok()
        .and_then(|wire_name| wire_name.as_str().map(str::to_owned))
        .unwrap_or_default()
}

fn read_test_values(method_fields: &PaymentMethodFields) -> MethodTestValues {
    MethodTestValues {
        name: method_fields.name.clone(),
        test_cards: method_fields
            .test_cards
            .iter()
            .map(|test_card| TestValue {
                number: test_card.number.clone(),
                outcome: to_wire_name(test_card.outcome),
                decline_reason: test_card.decline_reason.map(to_wire_name),
            })
            .collect(),
        test_numbers: method_fields
            .test_numbers
            .iter()
            .map(|test_number| TestValue {
                number: test_number.number.clone(),
                outcome: to_wire_name(test_number.outcome),
                decline_reason: test_number.decline_reason.map(to_wire_name),
            })
            .collect(),
        otp: method_fields.otp.clone(),
        pin: method_fields.pin.clone(),
        default_outcome: to_wire_name(method_fields.default_outcome),
        test_account: method_fields.test_account.clone(),
    }
}

fn read_entries(checkout_request: &CheckoutCompleteRequest) -> CheckoutEntries {
    let step_entries = checkout_request.entries.clone().unwrap_or_default();
    CheckoutEntries {
        card: checkout_request
            .card
            .as_ref()
            .map(|checkout_card| CardEntry {
                number: checkout_card.number.clone(),
                exp_month: checkout_card.exp_month,
                exp_year: checkout_card.exp_year,
            }),
        number: step_entries.number,
        otp: step_entries.otp,
        pin: step_entries.pin,
    }
}

/// The method named in the request, else the first whose flow fits what was sent.
fn find_checkout_method<'methods>(
    offered_methods: &'methods [PaymentMethodFields],
    flow_steps: &BTreeMap<String, Vec<PaymentStepType>>,
    checkout_request: &CheckoutCompleteRequest,
) -> Option<&'methods PaymentMethodFields> {
    if let Some(method_key) = &checkout_request.method_key {
        return offered_methods
            .iter()
            .find(|method_fields| &method_fields.key == method_key);
    }
    let wanted_steps: &[PaymentStepType] = if checkout_request.card.is_some() {
        &[PaymentStepType::CardForm]
    } else if checkout_request
        .entries
        .as_ref()
        .is_some_and(|step_entries| step_entries.number.is_some())
    {
        &[PaymentStepType::AccountNumber, PaymentStepType::VoucherCode]
    } else {
        return offered_methods.first();
    };
    offered_methods.iter().find(|method_fields| {
        flow_steps
            .get(&method_fields.flow)
            .is_some_and(|step_types| step_types.iter().any(|step| wanted_steps.contains(step)))
    })
}

/// Each flow's step types, by flow key.
async fn load_flow_steps(
    operation_context: &OperationContext,
) -> Result<BTreeMap<String, Vec<PaymentStepType>>, OperationError> {
    Ok(load_payment_flows(operation_context)
        .await?
        .into_iter()
        .map(|payment_flow| {
            let step_types = payment_flow
                .steps
                .iter()
                .filter_map(|flow_step| PaymentStepType::parse(&flow_step.step_type))
                .collect();
            (payment_flow.key, step_types)
        })
        .collect())
}

fn to_instrument(paid_with: PaidWith) -> PaymentInstrument {
    match paid_with {
        PaidWith::Card {
            brand,
            last4,
            exp_month,
            exp_year,
        } => PaymentInstrument::Card {
            brand,
            last4,
            exp_month,
            exp_year,
        },
        PaidWith::Wallet {
            wallet_name,
            masked_number,
        } => PaymentInstrument::Wallet {
            wallet_name,
            masked_number,
        },
        PaidWith::Bank { bank_name } => PaymentInstrument::Bank { bank_name },
    }
}

/// Runs the method's flow against its test values step by step, then applies the outcome. A
/// refused step changes nothing, so a real card number is kept nowhere.
pub async fn pay_checkout(
    payment_change: &mut PaymentChange<'_>,
    operation_context: &OperationContext,
    checkout_request: &CheckoutCompleteRequest,
) -> Result<(), OperationError> {
    let offered_method_keys = payment_change.offered_method_keys();
    let all_methods = load_payment_methods(operation_context).await?;
    let offered_methods: Vec<PaymentMethodFields> = offered_method_keys
        .iter()
        .filter_map(|method_key| {
            all_methods.iter().find(|payment_method| {
                &payment_method.fields.key == method_key && payment_method.fields.is_enabled
            })
        })
        .map(|payment_method| payment_method.fields.clone())
        .collect();
    let flow_steps = load_flow_steps(operation_context).await?;
    let method_fields = find_checkout_method(&offered_methods, &flow_steps, checkout_request)
        .ok_or_else(|| refuse_payment("This checkout does not offer that payment method"))?;
    let step_types = flow_steps.get(&method_fields.flow).ok_or_else(|| {
        refuse_payment(format!("The {} flow no longer exists", method_fields.name))
    })?;
    let flow_run = run_payment_flow(
        step_types,
        &read_test_values(method_fields),
        &read_entries(checkout_request),
    );
    let (flow_outcome, paid_with) = match flow_run {
        FlowRun::Refused(message) => return Err(refuse_payment(message)),
        FlowRun::Finished { outcome, paid_with } => (outcome, paid_with),
    };
    payment_change.payment.method = Some(to_instrument(paid_with));
    payment_change.payment.method_key = Some(method_fields.key.clone());
    match flow_outcome {
        FlowOutcome::Succeed => payment_change.succeed(),
        FlowOutcome::SucceedThenDispute => {
            payment_change.succeed();
            payment_change.open_dispute();
        }
        FlowOutcome::ThreeDs => payment_change.show_three_ds(),
        FlowOutcome::Decline(decline_reason) => payment_change.decline(&decline_reason),
    }
    Ok(())
}
