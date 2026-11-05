/// A provider adapter's own object beside a payment, such as a Stripe refund, as the
/// adapter's JSON.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentProviderObjectRecord {
    /// The provider's id for it, e.g. `re_...`.
    pub object_id: String,
    /// The gateway's key.
    pub provider: String,
    /// What it is in the provider's words, e.g. `refund`.
    pub object_kind: String,
    pub payment_id: String,
    pub document_json: String,
    pub created_at_unix_ms: i64,
    pub updated_at_unix_ms: i64,
}
