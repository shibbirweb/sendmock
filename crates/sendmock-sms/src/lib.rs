//! The SMS domain: numbers, encoding and segments, conversations and delivery simulation.

mod encoding;
mod phone_number;
mod simulation;
mod sms_thread;

pub use encoding::{SegmentCount, SmsEncoding, count_segments};
pub use phone_number::{PhoneNumber, split_channel_prefix};
pub use simulation::{
    CustomOutcomeRule, DeliveryChange, DeliveryStep, MagicNumber, MatchField, OutcomeSource,
    PlannedOutcome, SendDecision, SendSimulation, SimulationProfile, SmsOutcomeKind,
    find_magic_number, is_twilio_test_from_number, is_valid_outcome_pattern,
    matches_outcome_pattern, plan_send, resolve_number_outcome,
};
pub use sms_thread::build_thread_id;
