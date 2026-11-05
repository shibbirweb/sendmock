//! Mailgun-style routes on incoming email: filters, actions and the requests they send.

mod mailgun_route_request;
mod mailgun_routes_api;
mod route_delivery;
mod route_expression_parser;
mod route_expressions;
mod route_operations;
mod route_records;
mod route_runner;
mod route_test_operation;
mod route_validation;
mod route_wire;
mod stored_message_answer;

pub(crate) use mailgun_routes_api::answer_mailgun_routes_request;
pub use route_operations::{
    CreateInboundRouteOperation, DeleteInboundRouteOperation, ListInboundRoutesOperation,
    UpdateInboundRouteOperation,
};
pub(crate) use route_runner::start_inbound_routes;
pub use route_test_operation::TestInboundRouteOperation;
pub use route_wire::{InboundRoute, InboundRouteAction, InboundRouteFilter};

use crate::OperationRegistry;

pub fn register_inbound_route_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListInboundRoutesOperation);
    operation_registry.register(CreateInboundRouteOperation);
    operation_registry.register(UpdateInboundRouteOperation);
    operation_registry.register(DeleteInboundRouteOperation);
    operation_registry.register(TestInboundRouteOperation);
}
