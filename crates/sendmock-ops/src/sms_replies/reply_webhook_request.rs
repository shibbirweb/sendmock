use sendmock_core::format_rfc3339;
use sendmock_sms::TwimlMethod;
use sendmock_store::SmsRecord;
use serde_json::{Value, json};

use super::reply_webhook_target::ReplyWebhookTarget;
use crate::providers::{
    ProviderWebhookTarget, build_callback_template_functions, collect_provider_credential_vars,
    find_builtin_webhook_template, load_sms_provider_definitions, render_provider_webhook_request,
};
use crate::sms::{RecordedHttpRequest, SmsMessage};
use crate::{OperationContext, OperationError};

/// Twilio's "A message comes in" request, the reply webhook's format unless the number or the
/// simulated message picks another.
pub const TWILIO_INBOUND_TEMPLATE_ID: &str = "twilio.inbound_sms";

/// Builds the requests one inbound message sends to your app: the reply webhook in the chosen
/// format, and the `<Redirect>` and `action` fetches its TwiML asks for, which carry Twilio's
/// inbound fields as Twilio sends them.
pub struct ReplyWebhookRequestBuilder {
    template_context: Value,
    template_id: String,
    operation_context: OperationContext,
}

impl ReplyWebhookRequestBuilder {
    /// The context every request renders from: the inbound message as `data` (with the
    /// number's Messaging Service), the providers' credentials as `vars` and `sendmock` for
    /// the media links. `template_override` is the simulated message's choice of format.
    pub async fn new(
        operation_context: &OperationContext,
        inbound_sms: &SmsRecord,
        target: &ReplyWebhookTarget,
        template_override: Option<&str>,
    ) -> Result<Self, OperationError> {
        let providers = load_sms_provider_definitions(operation_context).await?;
        let mut message_data = serde_json::to_value(SmsMessage::from(inbound_sms))
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
        message_data["messaging_service_sid"] = json!(target.messaging_service_sid);
        let instance_details = &operation_context.instance_details;
        let template_context = json!({
            "event": {
                "id": format!("evt_{}", inbound_sms.sms_id),
                "type": "sms.inbound",
                "created_at": format_rfc3339(inbound_sms.created_at_unix_ms),
            },
            "data": message_data,
            "vars": collect_provider_credential_vars(&providers),
            "endpoint": { "url": target.url },
            "sendmock": {
                "version": instance_details.version,
                "http_url": format!("http://{}", instance_details.http_address),
            },
        });
        let template_id = template_override
            .or(target.template_id.as_deref())
            .filter(|template_id| !template_id.trim().is_empty())
            .unwrap_or(TWILIO_INBOUND_TEMPLATE_ID)
            .to_owned();
        Ok(Self {
            template_context,
            template_id,
            operation_context: operation_context.clone(),
        })
    }

    /// The reply webhook to `url` with `method`, in the chosen format; a format SendMock does
    /// not ship falls back to Twilio's, so the number still gets its message.
    pub fn build_webhook_request(&self, url: &str, method: TwimlMethod) -> RecordedHttpRequest {
        self.render_chosen_format(url, method, &[])
    }

    /// The fallback URL's request once the reply webhook failed: the same fields plus
    /// `ErrorCode` and `ErrorUrl`, as Twilio sends them.
    pub fn build_fallback_request(
        &self,
        fallback_url: &str,
        method: TwimlMethod,
        error_code: &str,
        failed_url: &str,
    ) -> RecordedHttpRequest {
        let extra_form_fields = [
            ("ErrorCode".to_owned(), error_code.to_owned()),
            ("ErrorUrl".to_owned(), failed_url.to_owned()),
        ];
        self.render_chosen_format(fallback_url, method, &extra_form_fields)
    }

    fn render_chosen_format(
        &self,
        url: &str,
        method: TwimlMethod,
        extra_form_fields: &[(String, String)],
    ) -> RecordedHttpRequest {
        let template_id = if find_builtin_webhook_template(&self.template_id).is_some() {
            self.template_id.as_str()
        } else {
            tracing::warn!(
                template_id = self.template_id,
                "unknown reply webhook format, sending Twilio's"
            );
            TWILIO_INBOUND_TEMPLATE_ID
        };
        self.render(
            template_id,
            url,
            method,
            extra_form_fields,
            self.template_context.clone(),
        )
    }

    /// A `<Redirect>` fetch: the inbound fields again, signed for the new URL.
    pub fn build_redirect_request(&self, url: &str, method: TwimlMethod) -> RecordedHttpRequest {
        self.render(
            TWILIO_INBOUND_TEMPLATE_ID,
            url,
            method,
            &[],
            self.template_context.clone(),
        )
    }

    /// A `<Message action>` fetch once the reply is sent: the inbound fields with the reply's
    /// SID, plus `MessageStatus` and, when it failed, `ErrorCode`.
    pub fn build_action_request(
        &self,
        url: &str,
        method: TwimlMethod,
        reply: &SmsRecord,
    ) -> RecordedHttpRequest {
        let mut template_context = self.template_context.clone();
        template_context["data"]["provider_id"] = Value::from(reply.provider_id.clone());
        let mut extra_form_fields = vec![(
            "MessageStatus".to_owned(),
            describe_action_status(&reply.status).to_owned(),
        )];
        if let Some(error_code) = &reply.error_code {
            extra_form_fields.push(("ErrorCode".to_owned(), error_code.clone()));
        }
        self.render(
            TWILIO_INBOUND_TEMPLATE_ID,
            url,
            method,
            &extra_form_fields,
            template_context,
        )
    }

    fn render(
        &self,
        template_id: &str,
        url: &str,
        method: TwimlMethod,
        extra_form_fields: &[(String, String)],
        mut template_context: Value,
    ) -> RecordedHttpRequest {
        let webhook_template = find_builtin_webhook_template(template_id).unwrap_or_default();
        render_provider_webhook_request(
            &webhook_template,
            &ProviderWebhookTarget {
                url,
                method: Some(method.as_str()),
                extra_form_fields,
            },
            &mut template_context,
            &build_callback_template_functions(&self.operation_context),
        )
    }
}

/// The `MessageStatus` an `action` URL gets; Twilio documents `queued`, `sending`, `sent` and
/// `failed` there, so a reply already delivered reads as `sent`.
fn describe_action_status(reply_status: &str) -> &str {
    match reply_status {
        "sent" | "delivered" | "read" => "sent",
        "failed" | "undelivered" => "failed",
        other_status => other_status,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn action_statuses_use_the_names_twilio_documents_for_actions() {
        assert_eq!(describe_action_status("delivered"), "sent");
        assert_eq!(describe_action_status("undelivered"), "failed");
        assert_eq!(describe_action_status("queued"), "queued");
    }
}
