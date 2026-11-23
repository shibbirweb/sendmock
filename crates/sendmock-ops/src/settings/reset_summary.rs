use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Body of `POST /api/v1/reset`; with no body, a reset that keeps the configuration.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, JsonSchema)]
pub struct ResetRequest {
    /// Also remove every configured item (numbers, endpoints, rules, templates and the rest),
    /// put the settings and providers back to what SendMock ships with, and forget the seed.
    #[serde(default)]
    pub config: bool,
    /// With `config`: how many configured items the reset said it would remove; it is refused
    /// until this matches, so nothing goes unconfirmed.
    #[serde(default)]
    pub confirm_removed_count: Option<usize>,
}

/// How many items of one kind, such as `Webhook endpoint` or `emails`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct ResetItemCount {
    pub kind: String,
    pub count: u64,
}

/// What a reset did: the traffic it deleted, the configuration it removed with `config`, and
/// the configuration that stayed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct ResetSummary {
    /// Traffic deleted, by kind; kinds with nothing to delete are left out.
    pub cleared: Vec<ResetItemCount>,
    /// Configured items removed by a `config` reset, by kind; empty otherwise.
    pub removed: Vec<ResetItemCount>,
    /// Configured items that stayed, by kind.
    pub kept: Vec<ResetItemCount>,
    /// True when the seed applied last was applied again.
    pub restored_seed: bool,
}

/// Counts by kind, kinds in name order, kinds with nothing left out.
pub fn count_by_kind(kinds: impl IntoIterator<Item = String>) -> Vec<ResetItemCount> {
    let mut counts: BTreeMap<String, u64> = BTreeMap::new();
    for kind in kinds {
        *counts.entry(kind).or_default() += 1;
    }
    counts
        .into_iter()
        .map(|(kind, count)| ResetItemCount { kind, count })
        .collect()
}

/// Named counts in the given order, kinds with nothing left out.
pub fn keep_nonzero_counts(named_counts: &[(&str, u64)]) -> Vec<ResetItemCount> {
    named_counts
        .iter()
        .filter(|(_, count)| *count > 0)
        .map(|(kind, count)| ResetItemCount {
            kind: (*kind).to_owned(),
            count: *count,
        })
        .collect()
}

/// "3 Webhook endpoint, 1 Number", for the confirmation message.
pub fn describe_counts(item_counts: &[ResetItemCount]) -> String {
    item_counts
        .iter()
        .map(|item_count| format!("{} {}", item_count.count, item_count.kind))
        .collect::<Vec<_>>()
        .join(", ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_each_kind_once_in_name_order() {
        let item_counts = count_by_kind(
            ["Number", "Webhook endpoint", "Number"]
                .into_iter()
                .map(str::to_owned),
        );

        assert_eq!(
            describe_counts(&item_counts),
            "2 Number, 1 Webhook endpoint"
        );
    }

    #[test]
    fn kinds_with_nothing_are_left_out() {
        let item_counts = keep_nonzero_counts(&[("emails", 3), ("SMS messages", 0)]);

        assert_eq!(describe_counts(&item_counts), "3 emails");
    }
}
