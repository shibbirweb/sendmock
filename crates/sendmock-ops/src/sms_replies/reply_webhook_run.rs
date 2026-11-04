use std::collections::VecDeque;

use sendmock_sms::{TwimlMessage, TwimlVerb, resolve_twiml_url};
use sendmock_store::SmsRecord;

use super::reply_webhook_request::ReplyWebhookRequestBuilder;
use super::reply_webhook_target::{ReplyWebhookTarget, resolve_reply_webhook_target};
use super::twiml_fetch::fetch_twiml_verbs;
use super::twiml_reply::{TwimlReplyRequest, send_twiml_reply};
use crate::sms::RecordedHttpRequest;
use crate::{OperationContext, OperationError};

/// One inbound message triggers at most this many TwiML fetches, redirects and actions
/// included, so two handlers redirecting to each other cannot loop.
pub const MAXIMUM_TWIML_FETCHES: usize = 10;

/// Runs the reply webhook in the background, as Twilio calls it after the message arrived,
/// so the simulated send answers at once.
pub fn start_reply_webhook(
    operation_context: &OperationContext,
    inbound_sms: SmsRecord,
    template_override: Option<String>,
) {
    let background_context = operation_context.clone();
    tokio::spawn(async move {
        if let Err(run_error) = run_reply_webhook(
            &background_context,
            &inbound_sms,
            template_override.as_deref(),
        )
        .await
        {
            tracing::warn!(sms_id = inbound_sms.sms_id, error = %run_error, "reply webhook stopped");
        }
    });
}

/// Sends an inbound message to its number's reply webhook and acts on the TwiML answer in
/// order: each `<Message>` becomes a reply in the thread; a `<Redirect>`, or a `<Message>`
/// with an `action`, fetches new TwiML that replaces the verbs left. Returns the replies.
pub async fn run_reply_webhook(
    operation_context: &OperationContext,
    inbound_sms: &SmsRecord,
    template_override: Option<&str>,
) -> Result<Vec<SmsRecord>, OperationError> {
    let Some(target) =
        resolve_reply_webhook_target(operation_context, &inbound_sms.to_number).await?
    else {
        return Ok(Vec::new());
    };
    let request_builder =
        ReplyWebhookRequestBuilder::new(operation_context, inbound_sms, &target, template_override)
            .await?;
    let mut conversation = TwimlConversation {
        operation_context,
        inbound_sms,
        target: &target,
        request_builder,
        fetch_count: 0,
        document_url: target.url.clone(),
        replies: Vec::new(),
    };
    let first_request = conversation
        .request_builder
        .build_webhook_request(&target.url, target.method);
    let first_verbs = conversation.fetch(target.url.clone(), &first_request).await;
    conversation.follow(first_verbs).await?;
    Ok(conversation.replies)
}

/// The state of one inbound message's TwiML exchange.
struct TwimlConversation<'run> {
    operation_context: &'run OperationContext,
    inbound_sms: &'run SmsRecord,
    target: &'run ReplyWebhookTarget,
    request_builder: ReplyWebhookRequestBuilder,
    fetch_count: usize,
    /// The URL the verbs being followed came from.
    document_url: String,
    replies: Vec<SmsRecord>,
}

impl TwimlConversation<'_> {
    async fn fetch(
        &mut self,
        url: String,
        webhook_request: &RecordedHttpRequest,
    ) -> VecDeque<TwimlVerb> {
        self.fetch_count += 1;
        self.document_url = url;
        fetch_twiml_verbs(self.operation_context, webhook_request)
            .await
            .into()
    }

    fn has_fetches_left(&self) -> bool {
        if self.fetch_count >= MAXIMUM_TWIML_FETCHES {
            tracing::info!(
                sms_id = self.inbound_sms.sms_id,
                "stopped after {MAXIMUM_TWIML_FETCHES} TwiML fetches"
            );
            return false;
        }
        true
    }

    async fn follow(
        &mut self,
        mut pending_verbs: VecDeque<TwimlVerb>,
    ) -> Result<(), OperationError> {
        while let Some(twiml_verb) = pending_verbs.pop_front() {
            let next_document = match twiml_verb {
                TwimlVerb::Message(twiml_message) => self.reply(&twiml_message).await?,
                TwimlVerb::Redirect(twiml_redirect) => {
                    let url = resolve_twiml_url(&self.document_url, &twiml_redirect.url);
                    let redirect_request = self
                        .request_builder
                        .build_redirect_request(&url, twiml_redirect.method);
                    Some((url, redirect_request))
                }
            };
            if let Some((url, next_request)) = next_document {
                if !self.has_fetches_left() {
                    break;
                }
                pending_verbs = self.fetch(url, &next_request).await;
            }
        }
        Ok(())
    }

    /// Sends the reply; with an `action`, answers the request that fetches what comes next.
    async fn reply(
        &mut self,
        twiml_message: &TwimlMessage,
    ) -> Result<Option<(String, RecordedHttpRequest)>, OperationError> {
        let reply = send_twiml_reply(
            self.operation_context,
            &TwimlReplyRequest {
                inbound_sms: self.inbound_sms,
                twiml_message,
                document_url: &self.document_url,
                messaging_service_sid: self.target.messaging_service_sid.as_deref(),
            },
        )
        .await?;
        let action_request = twiml_message.action.as_deref().map(|action_url| {
            let url = resolve_twiml_url(&self.document_url, action_url);
            let action_request =
                self.request_builder
                    .build_action_request(&url, twiml_message.method, &reply);
            (url, action_request)
        });
        self.replies.push(reply);
        Ok(action_request)
    }
}
