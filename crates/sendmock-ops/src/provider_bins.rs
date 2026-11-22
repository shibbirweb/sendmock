//! HTTP Catcher bins on a provider's own URL (PL-21): a provider sends the requests no
//! built-in operation answers to its attached bin, which captures them, answers with its rules
//! and can send a follow-up webhook.

mod provider_area;
mod provider_bin_operations;
mod provider_bin_views;
mod provider_gap_answer;
mod provider_gap_resolution;

pub use provider_area::ProviderArea;
pub use provider_bin_operations::{
    AttachProviderBinOperation, DetachProviderBinOperation, ListProviderBinsOperation,
};
pub use provider_bin_views::ProviderBin;
pub(crate) use provider_bin_views::ProviderBinAttachment;
pub use provider_gap_answer::{ProviderGapAnswer, ProviderGapOrigin, answer_provider_gap};

use crate::OperationRegistry;

pub fn register_provider_bin_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListProviderBinsOperation);
    operation_registry.register(AttachProviderBinOperation);
    operation_registry.register(DetachProviderBinOperation);
}
