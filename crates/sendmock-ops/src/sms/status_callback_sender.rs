use std::future::Future;
use std::pin::Pin;

use super::http_call_result::HttpCallResult;
use super::sms_views::RecordedHttpRequest;

/// Sends a rendered status callback; the binary provides the HTTP one.
pub trait StatusCallbackSender: Send + Sync {
    fn send_status_callback<'sender>(
        &'sender self,
        callback_request: &'sender RecordedHttpRequest,
    ) -> Pin<Box<dyn Future<Output = HttpCallResult> + Send + 'sender>>;
}
