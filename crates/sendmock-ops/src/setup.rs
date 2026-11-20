//! The versioned setup file (A18): the seed file with a `[sendmock]` header, the rules for
//! files written by older and newer SendMock releases, and the migrations between formats.

mod format_one_to_two_migration;
mod setup_format_history;
mod setup_header;
mod setup_migration;
mod setup_preparation;
mod setup_version_policy;

pub use setup_header::{CURRENT_FORMAT_VERSION, SETUP_FORMAT_NAME, SetupHeader};
pub(crate) use setup_header::{HEADER_KEY, build_setup_header, check_setup_header};
pub(crate) use setup_preparation::prepare_setup_document;
pub use setup_version_policy::{SetupVersionDecision, SetupVersionPolicy};
