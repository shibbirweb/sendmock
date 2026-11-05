//! Payment domain: the checkout flow steps, the label variables and the rules a flow follows.

mod flow;
mod method;

pub use flow::{
    FLOW_LABEL_VARIABLE_NAMES, FlowProblem, FlowStep, MAXIMUM_FLOW_STEPS, PaymentFlowDraft,
    PaymentStepType, add_flow_step, check_payment_flow, find_unknown_variables, move_flow_step,
    remove_flow_step,
};
pub use method::{
    MethodProblem, PaymentMethodDraft, TEST_CARD_PREFIXES, TestNumberDraft, check_payment_method,
    is_test_card_range, passes_luhn_check, to_card_digits, to_test_number,
};
