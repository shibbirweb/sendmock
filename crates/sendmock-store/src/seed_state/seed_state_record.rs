/// The seed file applied last.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SeedStateRecord {
    pub seed_toml: String,
    /// The file it was read from; none when it was pasted or sent over the API.
    pub source_path: Option<String>,
    pub applied_at_unix_ms: i64,
    /// The configuration right after applying, as JSON, to tell what changed since.
    pub applied_items_json: String,
}
