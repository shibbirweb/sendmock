//! Payment subscriptions, each renewed on its own clock (PY-07.4).

mod subscription_charge;
mod subscription_lifecycle;
mod subscription_operations;
mod subscription_store;
mod subscription_views;

pub use subscription_operations::{
    AdvanceSubscriptionOperation, CancelSubscriptionOperation, CreateSubscriptionOperation,
    GetSubscriptionOperation, ListSubscriptionsOperation,
};

use crate::OperationRegistry;

pub fn register_subscription_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListSubscriptionsOperation);
    operation_registry.register(CreateSubscriptionOperation);
    operation_registry.register(GetSubscriptionOperation);
    operation_registry.register(AdvanceSubscriptionOperation);
    operation_registry.register(CancelSubscriptionOperation);
}
