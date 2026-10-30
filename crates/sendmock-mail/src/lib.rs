//! The email domain: parsing messages, extracting codes and links, tags, and storing what arrives.

mod delivery_outcome;
mod email_ingest_service;
mod extraction;
mod incoming_email;
mod mail_error;
mod native_message;
mod parsing;
mod raw_message_codec;

pub use delivery_outcome::{
    BounceType, DeliveryProfile, EmailDeliveryEvent, EmailOutcome, FOLLOW_UP_DELAY_MS,
    OutcomeAction, OutcomeSettings, OutcomeSource, OutcomeStep, PROFILE_DELAY_MS, PlannedOutcome,
    find_magic_address_outcome, plan_email_outcome,
};
pub use email_ingest_service::{EmailIngestService, IngestOptions};
pub use extraction::{
    DEFAULT_OTP_PATTERNS, OtpExtractor, extract_header_tags, extract_links,
    extract_plus_address_tags,
};
pub use incoming_email::{EmailEnvelope, IncomingEmail};
pub use mail_error::MailError;
pub use native_message::{NativeAttachment, NativeMessage, build_raw_message, guess_content_type};
pub use parsing::{MimeTreeNode, ParsedAttachment, ParsedEmail, parse_email};
pub use raw_message_codec::{compress_raw_message, decompress_raw_message};
