//! The SMS domain: numbers, encoding and segments, conversations and delivery simulation.

mod encoding;
mod phone_number;
mod sms_thread;

pub use encoding::{SegmentCount, SmsEncoding, count_segments};
pub use phone_number::{PhoneNumber, split_channel_prefix};
pub use sms_thread::build_thread_id;
