//! Razorpay's orders, payments and refunds on the provider port, backed by the `razorpay`
//! gateway.

mod razorpay_api_adapter;
mod razorpay_call;
mod razorpay_entities;
mod razorpay_error;
mod razorpay_event_object;
mod razorpay_orders;
mod razorpay_payments;

pub(crate) use razorpay_api_adapter::answer_razorpay_request;
pub(crate) use razorpay_call::RAZORPAY_PROVIDER_KEY;
pub(crate) use razorpay_event_object::{
    describe_razorpay_event_object, describe_razorpay_redirect_object,
};
