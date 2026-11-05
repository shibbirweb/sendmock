/// A stored test payment: the columns the list filters by, and the payment as JSON.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentRecord {
    pub payment_id: String,
    /// The gateway's key.
    pub provider: String,
    /// The payment method it was paid with; none until the checkout is paid.
    pub method_key: Option<String>,
    pub status: String,
    pub currency: String,
    pub document_json: String,
    pub created_at_unix_ms: i64,
    pub updated_at_unix_ms: i64,
}

/// Which payments to list; every field narrows the list.
#[derive(Debug, Clone, Default)]
pub struct PaymentListFilter {
    /// One status, or several separated by commas.
    pub statuses: Vec<String>,
    pub provider: Option<String>,
    pub currency: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentPage {
    pub payments: Vec<PaymentRecord>,
    pub next_cursor: Option<String>,
    pub total_count: u64,
}
