use std::collections::BTreeMap;

use serde::Deserialize;

/// Exported from the mock's fixtures with the provider definitions.
const BUILTIN_WEBHOOK_TEMPLATES_JSON: &str = include_str!("../../builtin/webhook-templates.json");

/// The request a webhook template renders: `twilio.status_callback`, `vonage.dlr`, ...
#[derive(Debug, Clone, PartialEq, Eq, Default, Deserialize)]
#[serde(default)]
pub struct WebhookTemplateDefinition {
    pub method: String,
    pub content_type: String,
    pub header_templates: BTreeMap<String, String>,
    pub body_template: String,
}

pub fn find_builtin_webhook_template(template_key: &str) -> Option<WebhookTemplateDefinition> {
    let mut templates: BTreeMap<String, WebhookTemplateDefinition> =
        serde_json::from_str(BUILTIN_WEBHOOK_TEMPLATES_JSON).unwrap_or_default();
    templates.remove(template_key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_status_callback_templates_ship() {
        let twilio_template = find_builtin_webhook_template("twilio.status_callback");
        let vonage_template = find_builtin_webhook_template("vonage.dlr");

        assert_eq!(
            twilio_template.map(|template| template.content_type),
            Some("application/x-www-form-urlencoded".to_owned())
        );
        assert_eq!(
            vonage_template.map(|template| template.content_type),
            Some("application/json".to_owned())
        );
    }
}
