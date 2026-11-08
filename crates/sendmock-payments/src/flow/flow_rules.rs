use std::collections::HashSet;

use super::flow_label_variables::{FLOW_LABEL_VARIABLE_NAMES, find_unknown_variables};
use super::{FlowStep, PaymentFlowDraft};

pub const MAXIMUM_FLOW_STEPS: usize = 6;

/// The first thing wrong with a flow: the field (`key`, `name`, `picker_tab`, `steps` or
/// `steps.<index>`) and what to do about it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FlowProblem {
    pub field: String,
    pub message: String,
}

fn problem(field: &str, message: String) -> FlowProblem {
    FlowProblem {
        field: field.to_owned(),
        message,
    }
}

/// 2 to 32 lowercase letters, digits or `_`, starting with a letter.
fn is_flow_key(flow_key: &str) -> bool {
    let mut characters = flow_key.chars();
    let starts_with_letter = characters
        .next()
        .is_some_and(|first_character| first_character.is_ascii_lowercase());
    (2..=32).contains(&flow_key.len())
        && starts_with_letter
        && characters.all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '_'
        })
}

fn check_key(flow_draft: &PaymentFlowDraft, existing_keys: &[String]) -> Result<(), FlowProblem> {
    if !is_flow_key(&flow_draft.key) {
        return Err(problem(
            "key",
            "Use 2 to 32 lowercase letters, digits or _, starting with a letter".to_owned(),
        ));
    }
    if existing_keys.contains(&flow_draft.key) {
        return Err(problem(
            "key",
            format!("A flow with the key {} already exists", flow_draft.key),
        ));
    }
    Ok(())
}

fn check_steps(flow_steps: &[FlowStep]) -> Result<(), FlowProblem> {
    if flow_steps.is_empty() {
        return Err(problem("steps", "Add at least one step".to_owned()));
    }
    if let Some(unknown_step) = flow_steps.iter().find(|step| step.known_type().is_none()) {
        return Err(problem(
            "steps",
            format!(
                "{} is not a step type SendMock knows",
                unknown_step.step_type
            ),
        ));
    }
    if flow_steps.len() > MAXIMUM_FLOW_STEPS {
        return Err(problem(
            "steps",
            format!("A flow has at most {MAXIMUM_FLOW_STEPS} steps"),
        ));
    }
    let deciding_count = flow_steps
        .iter()
        .filter(|step| {
            step.known_type()
                .is_some_and(|step_type| step_type.is_deciding())
        })
        .count();
    if deciding_count > 1 {
        return Err(problem(
            "steps",
            "Use one deciding step at most (card form, account number or voucher code)".to_owned(),
        ));
    }
    let distinct_types: HashSet<&str> = flow_steps
        .iter()
        .map(|step| step.step_type.as_str())
        .collect();
    if distinct_types.len() != flow_steps.len() {
        return Err(problem("steps", "Each step type appears once".to_owned()));
    }
    Ok(())
}

fn check_step_labels(step_index: usize, flow_step: &FlowStep) -> Result<(), FlowProblem> {
    let field = format!("steps.{step_index}");
    let Some(step_type) = flow_step.known_type() else {
        return Ok(());
    };
    let mut unknown_variables: Vec<String> = Vec::new();
    for unknown_variable in flow_step
        .labels()
        .into_iter()
        .flat_map(find_unknown_variables)
    {
        if !unknown_variables.contains(&unknown_variable) {
            unknown_variables.push(unknown_variable);
        }
    }
    if !unknown_variables.is_empty() {
        let known_tokens: Vec<String> = FLOW_LABEL_VARIABLE_NAMES
            .iter()
            .map(|variable_name| format!("{{{variable_name}}}"))
            .collect();
        return Err(problem(
            &field,
            format!(
                "{} is not a variable; use {}",
                unknown_variables.join(", "),
                known_tokens.join(", ")
            ),
        ));
    }
    if flow_step.button_label.trim().is_empty() {
        return Err(problem(&field, "Enter the button text".to_owned()));
    }
    if step_type.has_field() && flow_step.field_label.trim().is_empty() {
        return Err(problem(&field, "Enter the field label".to_owned()));
    }
    Ok(())
}

/// The rules the Flows screen and the API share: a new flow's key, a name, a picker tab, 1 to
/// 6 known steps with one deciding step at most and each type once, and labels that use only
/// the label variables. `existing_keys` are the other flows' keys, checked for a new flow.
pub fn check_payment_flow(
    flow_draft: &PaymentFlowDraft,
    existing_keys: &[String],
    is_new: bool,
) -> Result<(), FlowProblem> {
    if is_new {
        check_key(flow_draft, existing_keys)?;
    }
    if flow_draft.name.trim().is_empty() {
        return Err(problem("name", "Enter a name".to_owned()));
    }
    if flow_draft.picker_tab.trim().is_empty() {
        return Err(problem(
            "picker_tab",
            "Enter the picker tab, e.g. Mobile banking".to_owned(),
        ));
    }
    check_steps(&flow_draft.steps)?;
    for (step_index, flow_step) in flow_draft.steps.iter().enumerate() {
        check_step_labels(step_index, flow_step)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn step(step_type: &str, button_label: &str) -> FlowStep {
        FlowStep {
            step_type: step_type.to_owned(),
            title: String::new(),
            field_label: "Your number".to_owned(),
            hint: String::new(),
            button_label: button_label.to_owned(),
        }
    }

    fn wallet_flow(steps: Vec<FlowStep>) -> PaymentFlowDraft {
        PaymentFlowDraft {
            key: "wallet_otp".to_owned(),
            name: "Wallet with OTP".to_owned(),
            picker_tab: "Mobile banking".to_owned(),
            steps,
        }
    }

    fn problem_of(flow_draft: &PaymentFlowDraft) -> Option<(String, String)> {
        check_payment_flow(flow_draft, &["card".to_owned()], true)
            .err()
            .map(|flow_problem| (flow_problem.field, flow_problem.message))
    }

    #[test]
    fn accepts_a_flow_that_follows_the_rules() {
        let flow_draft = wallet_flow(vec![
            step("account_number", "Confirm"),
            step("otp", "Pay {amount}"),
        ]);
        assert_eq!(problem_of(&flow_draft), None);
    }

    #[test]
    fn refuses_a_bad_or_taken_key_only_for_a_new_flow() {
        let mut flow_draft = wallet_flow(vec![step("confirm", "Pay")]);
        flow_draft.key = "Card".to_owned();
        assert_eq!(
            problem_of(&flow_draft).map(|(field, _)| field),
            Some("key".to_owned())
        );
        flow_draft.key = "card".to_owned();
        assert!(
            problem_of(&flow_draft).is_some_and(|(_, message)| message.contains("already exists"))
        );
        assert_eq!(
            check_payment_flow(&flow_draft, &["card".to_owned()], false),
            Ok(())
        );
    }

    #[test]
    fn refuses_steps_that_break_the_catalogue_rules() {
        let message_of = |steps| problem_of(&wallet_flow(steps)).map(|(_, message)| message);
        assert_eq!(
            message_of(Vec::new()),
            Some("Add at least one step".to_owned())
        );
        assert_eq!(
            message_of(vec![step("fingerprint", "Go")]),
            Some("fingerprint is not a step type SendMock knows".to_owned())
        );
        assert!(
            message_of(vec![step("card_form", "Pay"), step("voucher_code", "Pay")])
                .is_some_and(|message| message.starts_with("Use one deciding step"))
        );
        assert_eq!(
            message_of(vec![step("otp", "Go"), step("otp", "Go")]),
            Some("Each step type appears once".to_owned())
        );
    }

    #[test]
    fn names_the_step_whose_labels_are_wrong() {
        let flow_draft = wallet_flow(vec![
            step("confirm", "Pay"),
            step("pin", "Pay with {methd}"),
        ]);
        let (field, message) = problem_of(&flow_draft).unwrap_or_default();
        assert_eq!(field, "steps.1");
        assert!(message.starts_with("{methd} is not a variable; use {method}, {amount}"));
        let blank_button = wallet_flow(vec![step("confirm", " ")]);
        assert_eq!(
            problem_of(&blank_button),
            Some(("steps.0".to_owned(), "Enter the button text".to_owned()))
        );
    }
}
