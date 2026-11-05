//! Payment domain: the checkout flow steps, the label variables and the rules a flow follows.

mod checkout;
mod flow;
mod gateway;
mod method;
mod money;

pub use checkout::{
    CardEntry, CheckoutEntries, FlowOutcome, FlowRun, MethodTestValues, PaidWith, TestValue,
    read_card_brand, run_payment_flow,
};
pub use flow::{
    FLOW_LABEL_VARIABLE_NAMES, FlowProblem, FlowStep, MAXIMUM_FLOW_STEPS, PaymentFlowDraft,
    PaymentStepType, add_flow_step, check_payment_flow, find_unknown_variables, move_flow_step,
    remove_flow_step,
};
pub use gateway::{GatewayProblem, PaymentGatewayDraft, check_new_gateway, check_payment_gateway};
pub use method::{
    MethodProblem, PaymentMethodDraft, TEST_CARD_PREFIXES, TestNumberDraft, check_payment_method,
    is_test_card_range, passes_luhn_check, to_card_digits, to_test_number,
};
pub use money::{currency_exponent, format_major_amount, is_currency_code};
