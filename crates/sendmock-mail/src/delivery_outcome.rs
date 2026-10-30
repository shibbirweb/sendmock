mod email_delivery_event;
mod email_outcome;
mod magic_address;
mod outcome_planner;

pub use email_delivery_event::{BounceType, EmailDeliveryEvent};
pub use email_outcome::{EmailOutcome, FOLLOW_UP_DELAY_MS, OutcomeAction, OutcomeStep};
pub use magic_address::find_magic_address_outcome;
pub use outcome_planner::{
    DeliveryProfile, OutcomeSettings, OutcomeSource, PROFILE_DELAY_MS, PlannedOutcome,
    plan_email_outcome,
};
