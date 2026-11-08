use super::operation_matcher::ProviderRoute;
use super::provider_http::ProviderHttpRequest;
use super::provider_runtime::ProviderOutcome;
use crate::bkash::answer_bkash_request;
use crate::paddle::answer_paddle_request;
use crate::paypal::answer_paypal_request;
use crate::razorpay::answer_razorpay_request;
use crate::sslcommerz::answer_sslcommerz_request;
use crate::stripe::answer_stripe_request;
use crate::{OperationContext, OperationError};

/// The built-in payment gateways' APIs. Razorpay goes before Stripe: on a shared provider port
/// both answer under `/v1/`.
pub async fn answer_payment_gateway_api(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    if let Some(razorpay_outcome) =
        answer_razorpay_request(operation_context, provider_route, request).await?
    {
        return Ok(Some(razorpay_outcome));
    }
    if let Some(stripe_outcome) =
        answer_stripe_request(operation_context, provider_route, request).await?
    {
        return Ok(Some(stripe_outcome));
    }
    if let Some(paypal_outcome) =
        answer_paypal_request(operation_context, provider_route, request).await?
    {
        return Ok(Some(paypal_outcome));
    }
    if let Some(sslcommerz_outcome) =
        answer_sslcommerz_request(operation_context, provider_route, request).await?
    {
        return Ok(Some(sslcommerz_outcome));
    }
    if let Some(bkash_outcome) =
        answer_bkash_request(operation_context, provider_route, request).await?
    {
        return Ok(Some(bkash_outcome));
    }
    answer_paddle_request(operation_context, provider_route, request).await
}
