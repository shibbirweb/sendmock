use sendmock_store::StoreError;

#[derive(Debug, thiserror::Error)]
pub enum MailError {
    #[error(transparent)]
    Store(#[from] StoreError),

    #[error("Could not compress or decompress the raw message: {0}")]
    Compression(#[from] std::io::Error),
}
