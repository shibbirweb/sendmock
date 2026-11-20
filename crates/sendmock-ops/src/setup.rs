//! The versioned setup file: the seed file with a `[sendmock]` header, the rules for files
//! written by older and newer SendMock releases, the migrations between formats, and secrets
//! encrypted with a passphrase.

mod format_one_to_two_migration;
mod setup_document_reader;
mod setup_document_writer;
mod setup_download;
mod setup_fetch_error;
mod setup_fetcher;
mod setup_file_format;
mod setup_format_history;
mod setup_header;
mod setup_json_schema;
mod setup_migration;
mod setup_preparation;
mod setup_problem;
mod setup_secret_cipher;
mod setup_secret_error;
mod setup_secret_opener;
mod setup_secret_writer;
mod setup_version_policy;
mod toml_key_lines;

pub use setup_document_reader::read_setup_document;
pub use setup_document_writer::write_setup_document;
pub(crate) use setup_document_writer::{ExportedSection, write_setup_export};
pub use setup_download::{DownloadedSetup, SetupUrlSource, download_setup};
pub use setup_fetch_error::SetupFetchError;
pub use setup_fetcher::{
    FetchedSetupFile, SetupFetchFuture, SetupFetchLimits, SetupFetchRequest, SetupFetcher,
    SetupRequestHeader, is_plain_http_address_allowed,
};
pub use setup_file_format::SetupFileFormat;
pub use setup_header::{CURRENT_FORMAT_VERSION, SETUP_FORMAT_NAME, SetupHeader};
pub(crate) use setup_header::{HEADER_KEY, build_setup_header, check_setup_header};
pub use setup_json_schema::{build_setup_json_schema, setup_json_schema_url};
pub(crate) use setup_preparation::prepare_setup_document;
pub use setup_problem::SetupProblem;
pub(crate) use setup_problem::join_location;
pub use setup_secret_cipher::{ENCRYPTED_SECRET_PREFIX, EncryptedSecret};
pub use setup_secret_error::SetupSecretError;
pub(crate) use setup_secret_opener::find_encrypted_secret_spans;
pub use setup_secret_opener::{SetupSecretOpener, blank_encrypted_secrets};
pub use setup_secret_writer::{EncryptedSecretWriter, SecretReferenceWriter, SetupSecretWriter};
pub use setup_version_policy::{SetupVersionDecision, SetupVersionPolicy};
pub(crate) use toml_key_lines::TomlKeyLines;
