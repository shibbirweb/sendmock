mod address_outcome_resolver;
mod email_delivery_event;
mod email_outcome;
mod email_outcome_rule;
mod magic_address;
mod outcome_planner;

pub use address_outcome_resolver::{AddressOutcomeSource, resolve_address_outcome};
pub use email_delivery_event::{BounceType, EmailDeliveryEvent};
pub use email_outcome::{EmailOutcome, FOLLOW_UP_DELAY_MS, OutcomeAction, OutcomeStep};
pub use email_outcome_rule::{
    EmailOutcomeRule, EmailRuleOutcome, RecipientRefusal, is_valid_address_pattern,
    is_valid_refusal_code,
};
pub use magic_address::find_magic_address_outcome;
pub use outcome_planner::{
    DeliveryProfile, OutcomeSettings, OutcomeSource, PROFILE_DELAY_MS, PlannedOutcome,
    plan_email_outcome,
};
