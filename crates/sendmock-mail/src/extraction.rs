mod link_extractor;
mod otp_extractor;
mod tag_extractor;

pub use link_extractor::extract_links;
pub use otp_extractor::{DEFAULT_OTP_PATTERNS, OtpExtractor};
pub use tag_extractor::{extract_header_tags, extract_plus_address_tags};
