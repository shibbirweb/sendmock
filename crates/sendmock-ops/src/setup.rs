//! The versioned setup file (A18): the seed file with a `[sendmock]` header, the rules for
//! files written by older and newer SendMock releases, and the migrations between formats.

mod format_one_to_two_migration;
mod setup_document_reader;
mod setup_document_writer;
mod setup_file_format;
mod setup_format_history;
mod setup_header;
mod setup_json_schema;
mod setup_migration;
mod setup_preparation;
mod setup_problem;
mod setup_version_policy;
mod toml_key_lines;

pub use setup_document_reader::read_setup_document;
pub use setup_document_writer::write_setup_document;
pub(crate) use setup_document_writer::{ExportedSection, write_setup_export};
pub use setup_file_format::SetupFileFormat;
pub use setup_header::{CURRENT_FORMAT_VERSION, SETUP_FORMAT_NAME, SetupHeader};
pub(crate) use setup_header::{HEADER_KEY, build_setup_header, check_setup_header};
pub use setup_json_schema::{build_setup_json_schema, setup_json_schema_url};
pub(crate) use setup_preparation::prepare_setup_document;
pub use setup_problem::SetupProblem;
pub(crate) use setup_problem::join_location;
pub use setup_version_policy::{SetupVersionDecision, SetupVersionPolicy};
pub(crate) use toml_key_lines::TomlKeyLines;
