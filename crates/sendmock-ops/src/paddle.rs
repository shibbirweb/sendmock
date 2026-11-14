//! Paddle Billing's transactions and refunds on the provider port, backed by the `paddle`
//! gateway.

mod paddle_adjustments;
mod paddle_api_adapter;
mod paddle_call;
mod paddle_entities;
mod paddle_error;
mod paddle_event_object;
mod paddle_transactions;

pub(crate) use paddle_api_adapter::answer_paddle_request;
pub(crate) use paddle_call::PADDLE_PROVIDER_KEY;
pub(crate) use paddle_event_object::describe_paddle_event_object;
