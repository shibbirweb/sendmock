use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;

use sendmock_ops::RecordedHttpRequest;
use serde_json::{Value, json};

use super::scripted_twiml_app::ScriptedTwimlApp;
use super::test_app::{build_test_app_with, call_api};

/// The number your app owns in these tests, and the contact who texts it.
pub const APP_NUMBER: &str = "+15550001111";
pub const CONTACT_NUMBER: &str = "+15550002222";
pub const INBOUND_URL: &str = "http://app.test/sms/inbound";
/// The shipped Twilio definition's auth token, which signs its webhooks.
pub const TWILIO_AUTH_TOKEN: &str = "twilio-test-token";

/// A SendMock instance whose reply webhooks and media downloads go to a scripted app.
pub struct ReplyWebhookFixture {
    pub app_router: axum::Router,
    pub twiml_app: Arc<ScriptedTwimlApp>,
}

impl ReplyWebhookFixture {
    pub async fn new(twiml_app: ScriptedTwimlApp) -> Self {
        let twiml_app = Arc::new(twiml_app);
        let (sender_for_context, fetcher_for_context) =
            (Arc::clone(&twiml_app), Arc::clone(&twiml_app));
        let (app_router, _) = build_test_app_with(move |operation_context| {
            operation_context
                .with_reply_webhook_sender(sender_for_context)
                .with_media_fetcher(fetcher_for_context)
        });
        let instant_profile = json!({ "sms_simulation_profile": "instant" });
        let (status, _) = call_api(
            &app_router,
            "PATCH",
            "/api/v1/settings",
            Some(&instant_profile),
        )
        .await;
        assert_eq!(status, 200);
        Self {
            app_router,
            twiml_app,
        }
    }

    pub async fn post(&self, path: &str, request_body: &Value) -> Value {
        let (status, created) = call_api(&self.app_router, "POST", path, Some(request_body)).await;
        assert!(status == 200 || status == 201, "{status} {created}");
        created
    }

    /// Registers `APP_NUMBER` with these inbound settings over the defaults (Twilio's format,
    /// `POST` to `INBOUND_URL`).
    pub async fn create_number(&self, changed_settings: Value) -> Value {
        let mut number_input = json!({
            "number": APP_NUMBER,
            "label": "Support line",
            "channels": ["sms", "whatsapp"],
            "inbound_url": INBOUND_URL,
            "inbound_method": "POST",
            "inbound_fallback_url": null,
            "inbound_template_id": "twilio.inbound_sms",
            "status_callback_url": null,
            "messaging_service_sid": null,
        });
        if let (Some(input_fields), Value::Object(changed_fields)) =
            (number_input.as_object_mut(), changed_settings)
        {
            input_fields.extend(changed_fields);
        }
        self.post("/api/v1/numbers", &number_input).await
    }

    /// A contact texts `APP_NUMBER`; answers the stored inbound message.
    pub async fn receive_text(&self, body: &str) -> Value {
        self.post(
            "/api/v1/sms/inbound",
            &json!({ "from": CONTACT_NUMBER, "to": APP_NUMBER, "body": body }),
        )
        .await
    }

    /// Polls until `count` TwiML replies to `inbound_sms_id` are stored; answers them oldest
    /// first.
    pub async fn wait_for_replies(&self, inbound_sms_id: &Value, count: usize) -> Vec<Value> {
        let mut replies = Vec::new();
        for _ in 0..200 {
            let (_, sms_page) = call_api(&self.app_router, "GET", "/api/v1/sms", None).await;
            replies = sms_page["items"]
                .as_array()
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .filter(|sms| &sms["in_reply_to_sms_id"] == inbound_sms_id)
                .collect();
            if replies.len() >= count {
                break;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
        replies.reverse();
        replies
    }
}

/// The fields of a form body, or of a `GET` request's query.
pub fn read_form_fields(webhook_request: &RecordedHttpRequest) -> BTreeMap<String, String> {
    let encoded_fields = if webhook_request.method == "GET" {
        webhook_request
            .url
            .split_once('?')
            .map(|(_, query)| query)
            .unwrap_or_default()
    } else {
        webhook_request.body.as_str()
    };
    serde_urlencoded::from_str::<Vec<(String, String)>>(encoded_fields)
        .unwrap_or_default()
        .into_iter()
        .collect()
}

pub fn read_header<'request>(
    webhook_request: &'request RecordedHttpRequest,
    header_name: &str,
) -> &'request str {
    webhook_request
        .headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case(header_name))
        .map(|(_, header_value)| header_value.as_str())
        .unwrap_or_default()
}
