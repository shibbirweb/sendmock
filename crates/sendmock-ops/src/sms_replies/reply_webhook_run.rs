use std::collections::VecDeque;

use sendmock_sms::{TwimlMessage, TwimlVerb, resolve_twiml_url};
use sendmock_store::SmsRecord;

use super::reply_webhook_failure::ReplyWebhookFailure;
use super::reply_webhook_request::ReplyWebhookRequestBuilder;
use super::reply_webhook_target::{
    ReplyWebhookTarget, ReplyWebhookTargetKind, resolve_reply_webhook_target,
};
use super::twiml_fetch::{TwimlFetch, TwimlFetchRequest, fetch_twiml};
use super::twiml_reply::{TwimlReplyRequest, send_twiml_reply};
use crate::sms::SmsMessage;
use crate::sms::{
    RecordedHttpRequest, ReplyWebhookOutcome, ReplyWebhookTargetName, SmsReplyWebhookResult,
};
use crate::{AppEventType, OperationContext, OperationError, publish_event};

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

/// Sends an inbound message to its number's reply webhook, and to the fallback URL with
/// `ErrorCode` and `ErrorUrl` when that fails, then acts on the TwiML answer in order: each
/// `<Message>` becomes a reply in the thread; a `<Redirect>`, or a `<Message>` with an
/// `action`, fetches new TwiML that replaces the verbs left. Every request is stored, and the
/// outcome replaces the message's last one. `None` when the number has no reply webhook.
pub async fn run_reply_webhook(
    operation_context: &OperationContext,
    inbound_sms: &SmsRecord,
    template_override: Option<&str>,
) -> Result<Option<SmsReplyWebhookResult>, OperationError> {
    let Some(target) =
        resolve_reply_webhook_target(operation_context, &inbound_sms.to_number).await?
    else {
        return Ok(None);
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
        last_fetch: None,
        primary_failure: None,
        used_fallback: false,
        replies: Vec::new(),
    };
    let first_verbs = conversation.fetch_first_document().await?;
    conversation.follow(first_verbs).await?;
    let reply_webhook_result = conversation.summarize();
    let reply_webhook_json = serde_json::to_string(&reply_webhook_result)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
    operation_context
        .sms_reply_webhook_repository
        .record_result(&inbound_sms.sms_id, reply_webhook_json)
        .await?;
    publish_reply_webhook_result(operation_context, &inbound_sms.sms_id).await?;
    Ok(Some(reply_webhook_result))
}

/// `sms.reply_webhook` with the message as the list shows it, so an open conversation shows
/// the result line under the bubble without a reload.
async fn publish_reply_webhook_result(
    operation_context: &OperationContext,
    sms_id: &str,
) -> Result<(), OperationError> {
    let Some(updated_sms) = operation_context
        .sms_repository
        .find_message(sms_id)
        .await?
    else {
        return Ok(());
    };
    let event_data = serde_json::to_value(SmsMessage::from(&updated_sms))
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
    publish_event(operation_context, AppEventType::SmsReplyWebhook, event_data);
    Ok(())
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
    last_fetch: Option<TwimlFetch>,
    /// Why the reply webhook's first request failed, kept after the fallback answered.
    primary_failure: Option<ReplyWebhookFailure>,
    used_fallback: bool,
    replies: Vec<SmsRecord>,
}

impl TwimlConversation<'_> {
    async fn fetch(
        &mut self,
        url: String,
        webhook_request: &RecordedHttpRequest,
        is_fallback: bool,
    ) -> Result<VecDeque<TwimlVerb>, OperationError> {
        self.fetch_count += 1;
        self.document_url = url;
        let twiml_fetch = fetch_twiml(
            self.operation_context,
            &TwimlFetchRequest {
                inbound_sms_id: &self.inbound_sms.sms_id,
                webhook_request,
                is_fallback,
            },
        )
        .await?;
        let verbs = twiml_fetch.verbs.clone().into();
        self.last_fetch = Some(twiml_fetch);
        Ok(verbs)
    }

    /// The reply webhook; when it fails and a fallback URL is set, the fallback with the
    /// failure's code. Nothing is retried, as Twilio does not retry reply webhooks.
    async fn fetch_first_document(&mut self) -> Result<VecDeque<TwimlVerb>, OperationError> {
        let target = self.target;
        let first_request = self
            .request_builder
            .build_webhook_request(&target.url, target.method);
        let first_verbs = self
            .fetch(target.url.clone(), &first_request, false)
            .await?;
        self.primary_failure = self
            .last_fetch
            .as_ref()
            .and_then(|fetch| fetch.failure.clone());
        let (Some(primary_failure), Some(fallback_url)) =
            (&self.primary_failure, &target.fallback_url)
        else {
            return Ok(first_verbs);
        };
        let fallback_request = self.request_builder.build_fallback_request(
            fallback_url,
            target.method,
            primary_failure.error_code(),
            &target.url,
        );
        self.used_fallback = true;
        self.fetch(fallback_url.clone(), &fallback_request, true)
            .await
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
                pending_verbs = self.fetch(url, &next_request, false).await?;
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

    /// The outcome shown under the bubble: the last request decides success, and the
    /// primary URL's failure is kept even when the fallback answered.
    fn summarize(&self) -> SmsReplyWebhookResult {
        let last_fetch = self.last_fetch.as_ref();
        let is_succeeded = last_fetch.is_some_and(|fetch| fetch.failure.is_none());
        SmsReplyWebhookResult {
            target: match self.target.kind {
                ReplyWebhookTargetKind::MessagingService => {
                    ReplyWebhookTargetName::MessagingService
                }
                ReplyWebhookTargetKind::Number => ReplyWebhookTargetName::Number,
            },
            outcome: if is_succeeded {
                ReplyWebhookOutcome::Succeeded
            } else {
                ReplyWebhookOutcome::Failed
            },
            status_code: last_fetch.and_then(|fetch| fetch.status_code),
            error_code: self
                .primary_failure
                .as_ref()
                .map(|failure| failure.error_code().to_owned()),
            used_fallback: self.used_fallback && is_succeeded,
            reply_count: u32::try_from(self.replies.len()).unwrap_or(u32::MAX),
        }
    }
}
