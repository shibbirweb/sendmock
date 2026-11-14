/// Message totals for the Overview tiles.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MessageTotalsRecord {
    pub email_count: u64,
    pub emails_since: u64,
    pub unread_email_count: u64,
    pub sms_count: u64,
    pub sms_since: u64,
    /// Incoming SMS not read yet, as the thread list counts them.
    pub unread_sms_count: u64,
    pub verification_count: u64,
    pub pending_verification_count: u64,
}

/// How many items arrived in one hour, counted from the start of the window.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HourlyCountRecord {
    pub hour_offset: u32,
    pub item_count: u64,
}

/// Emails and SMS per hour of a window; hours with nothing are left out.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct HourlyActivityRecord {
    pub email_counts: Vec<HourlyCountRecord>,
    pub sms_counts: Vec<HourlyCountRecord>,
}
