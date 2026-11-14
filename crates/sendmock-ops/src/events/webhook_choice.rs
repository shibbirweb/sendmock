use std::collections::BTreeMap;

/// What one action chose for its webhooks: the endpoints instead of the ones the rules pick
/// (WH-13.4), and payloads edited for this action only (WH-14.4). It travels on the request
/// and on each event the request publishes, so two actions running at once never see each
/// other's choice.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct WebhookChoice {
    /// Every chosen endpoint gets one delivery per event; none chosen sends no webhook. Left
    /// out, the rules decide.
    pub endpoint_ids: Option<Vec<String>>,
    /// Requests edited for this action, by endpoint.
    pub edited_requests: Vec<EditedWebhookRequest>,
}

/// A request edited before an action sends it to one endpoint (WH-14.3).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct EditedWebhookRequest {
    pub endpoint_id: String,
    /// The event the edit is for; left out, every event of the action to the endpoint.
    pub event_type: Option<String>,
    /// Sent exactly as written and signed over these bytes.
    pub body: String,
    /// Headers set or changed by name; the others stay as rendered.
    pub headers: BTreeMap<String, String>,
}

impl WebhookChoice {
    /// The edit this action made to its request for one event to one endpoint.
    pub fn find_edited_request(
        &self,
        endpoint_id: &str,
        event_type: &str,
    ) -> Option<&EditedWebhookRequest> {
        self.edited_requests.iter().find(|edited_request| {
            edited_request.endpoint_id == endpoint_id
                && edited_request
                    .event_type
                    .as_deref()
                    .is_none_or(|edited_event_type| edited_event_type == event_type)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn edit_for(endpoint_id: &str, event_type: Option<&str>, body: &str) -> EditedWebhookRequest {
        EditedWebhookRequest {
            endpoint_id: endpoint_id.to_owned(),
            event_type: event_type.map(str::to_owned),
            body: body.to_owned(),
            headers: BTreeMap::new(),
        }
    }

    #[test]
    fn an_edit_applies_to_its_endpoint_and_event_only() {
        let webhook_choice = WebhookChoice {
            endpoint_ids: None,
            edited_requests: vec![
                edit_for("endpoint_a", Some("email.bounced"), "bounced body"),
                edit_for("endpoint_b", None, "any event body"),
            ],
        };

        let found_bodies = [
            ("endpoint_a", "email.bounced"),
            ("endpoint_a", "email.delivered"),
            ("endpoint_b", "email.delivered"),
            ("endpoint_c", "email.bounced"),
        ]
        .map(|(endpoint_id, event_type)| {
            webhook_choice
                .find_edited_request(endpoint_id, event_type)
                .map(|edited_request| edited_request.body.as_str())
        });

        assert_eq!(
            found_bodies,
            [Some("bounced body"), None, Some("any event body"), None]
        );
    }
}
