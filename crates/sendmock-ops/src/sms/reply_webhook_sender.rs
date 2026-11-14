use std::future::Future;
use std::pin::Pin;

use super::http_call_result::HttpCallResult;
use super::sms_views::RecordedHttpRequest;

/// Sends a rendered reply webhook request (or a TwiML `<Redirect>` or `action` fetch) with its
/// own method and answers with the response, whose body may be TwiML; the binary provides the
/// HTTP one.
pub trait ReplyWebhookSender: Send + Sync {
    fn send_reply_webhook<'sender>(
        &'sender self,
        webhook_request: &'sender RecordedHttpRequest,
    ) -> Pin<Box<dyn Future<Output = HttpCallResult> + Send + 'sender>>;
}
