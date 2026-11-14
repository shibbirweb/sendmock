//! The MCP resources: URI templates over the read operations, so large bodies (raw messages,
//! attachments, deliveries) are read on purpose instead of filling a tool result (AI-03.1).

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use rmcp::model::{Resource, ResourceContents, ResourceTemplate};
use sendmock_ops::{OperationAnswer, to_snake_case};
use serde_json::{Map, Value};

use crate::McpToolCatalog;

/// One resource URI template and the operation that reads it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ResourceRoute {
    pub uri_template: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub operation_id: &'static str,
}

/// Every documented resource (docs/plan/14-ai-integration.md#resources).
pub const RESOURCE_ROUTES: [ResourceRoute; 15] = [
    ResourceRoute {
        uri_template: "sendmock://docs/skill",
        name: "skill",
        description: "The SendMock agent skill.",
        operation_id: "getAiSkill",
    },
    ResourceRoute {
        uri_template: "sendmock://docs/template-reference",
        name: "template-reference",
        description: "The webhook template values, filters and functions.",
        operation_id: "getWebhooksTemplateReference",
    },
    ResourceRoute {
        uri_template: "sendmock://docs/integrations/{stack}",
        name: "integration",
        description: "How to point an app on this stack at SendMock.",
        operation_id: "getIntegrationsByStack",
    },
    ResourceRoute {
        uri_template: "sendmock://emails",
        name: "emails",
        description: "The newest emails; subscribe to hear of new ones.",
        operation_id: "getEmails",
    },
    ResourceRoute {
        uri_template: "sendmock://emails/{emailId}",
        name: "email",
        description: "One email with its bodies and headers.",
        operation_id: "getEmailsByEmailId",
    },
    ResourceRoute {
        uri_template: "sendmock://emails/{emailId}/raw",
        name: "email-raw",
        description: "The email's original .eml.",
        operation_id: "getEmailsByEmailIdRaw",
    },
    ResourceRoute {
        uri_template: "sendmock://emails/{emailId}/mime/{partId}",
        name: "email-mime-part",
        description: "One MIME part of the email, decoded.",
        operation_id: "getEmailsByEmailIdMimeByPartId",
    },
    ResourceRoute {
        uri_template: "sendmock://emails/{emailId}/attachments/{attachmentIndex}",
        name: "email-attachment",
        description: "One attachment of the email.",
        operation_id: "getEmailsByEmailIdAttachmentsByAttachmentIndex",
    },
    ResourceRoute {
        uri_template: "sendmock://emails/{emailId}/parts/{attachmentIndex}/thumbnail",
        name: "email-thumbnail",
        description: "A thumbnail of an image attachment.",
        operation_id: "getEmailsByEmailIdPartsByAttachmentIndexThumbnail",
    },
    ResourceRoute {
        uri_template: "sendmock://sms",
        name: "sms-messages",
        description: "The newest SMS; subscribe to hear of new ones.",
        operation_id: "getSms",
    },
    ResourceRoute {
        uri_template: "sendmock://sms/{smsId}",
        name: "sms",
        description: "One SMS with its status history.",
        operation_id: "getSmsBySmsId",
    },
    ResourceRoute {
        uri_template: "sendmock://sms/{smsId}/media/{mediaIndex}",
        name: "sms-media",
        description: "One media file of an MMS.",
        operation_id: "getSmsBySmsIdMediaByMediaIndex",
    },
    ResourceRoute {
        uri_template: "sendmock://webhooks/deliveries",
        name: "deliveries",
        description: "The newest webhook deliveries; subscribe to hear of new ones.",
        operation_id: "getWebhooksDeliveries",
    },
    ResourceRoute {
        uri_template: "sendmock://webhooks/deliveries/{deliveryId}",
        name: "delivery",
        description: "One delivery with its full request and response.",
        operation_id: "getWebhooksDeliveriesByDeliveryId",
    },
    ResourceRoute {
        uri_template: "sendmock://webhooks/templates/{templateId}",
        name: "template",
        description: "One webhook template's definition.",
        operation_id: "getWebhooksTemplatesByTemplateId",
    },
];

fn is_template(uri_template: &str) -> bool {
    uri_template.contains('{')
}

/// The routes without parameters, listed as resources.
pub fn list_fixed_resources() -> Vec<Resource> {
    RESOURCE_ROUTES
        .iter()
        .filter(|route| !is_template(route.uri_template))
        .map(|route| {
            Resource::new(route.uri_template, route.name).with_description(route.description)
        })
        .collect()
}

/// The routes with parameters, listed as templates.
pub fn list_resource_templates() -> Vec<ResourceTemplate> {
    RESOURCE_ROUTES
        .iter()
        .filter(|route| is_template(route.uri_template))
        .map(|route| {
            ResourceTemplate::new(route.uri_template, route.name)
                .with_description(route.description)
        })
        .collect()
}

/// A path value: a number when it is one, as indexes are.
fn read_input_value(path_value: &str) -> Value {
    path_value
        .parse::<u64>()
        .map_or_else(|_| Value::from(path_value), Value::from)
}

/// The route a URI matches and the operation input its path values make.
pub fn match_resource_uri(uri: &str) -> Option<(ResourceRoute, Map<String, Value>)> {
    let uri_segments: Vec<&str> = uri.split('/').collect();
    RESOURCE_ROUTES.iter().find_map(|route| {
        let template_segments: Vec<&str> = route.uri_template.split('/').collect();
        if template_segments.len() != uri_segments.len() {
            return None;
        }
        let mut operation_input = Map::new();
        for (template_segment, uri_segment) in template_segments.iter().zip(&uri_segments) {
            match template_segment
                .strip_prefix('{')
                .and_then(|name| name.strip_suffix('}'))
            {
                Some(parameter_name) if !uri_segment.is_empty() => {
                    operation_input
                        .insert(to_snake_case(parameter_name), read_input_value(uri_segment));
                }
                Some(_) => return None,
                None if template_segment != uri_segment => return None,
                None => {}
            }
        }
        Some((*route, operation_input))
    })
}

/// The answer as resource contents: JSON and text as text, other files as Base64.
pub fn to_resource_contents(uri: &str, operation_answer: OperationAnswer) -> ResourceContents {
    match operation_answer {
        OperationAnswer::Json(json_answer) => ResourceContents::text(
            serde_json::to_string_pretty(&json_answer).unwrap_or_default(),
            uri,
        )
        .with_mime_type("application/json"),
        OperationAnswer::File(file_answer) => match String::from_utf8(file_answer.bytes.clone()) {
            Ok(file_text) if !file_answer.content_type.starts_with("image/") => {
                ResourceContents::text(file_text, uri).with_mime_type(file_answer.content_type)
            }
            _ => ResourceContents::blob(STANDARD.encode(&file_answer.bytes), uri)
                .with_mime_type(file_answer.content_type),
        },
        OperationAnswer::Empty => ResourceContents::text("", uri),
    }
}

/// Reads the resource through its operation; an unknown URI or a failed read is an error.
pub async fn read_resource(
    tool_catalog: &McpToolCatalog,
    uri: &str,
) -> Result<ResourceContents, String> {
    let (route, operation_input) =
        match_resource_uri(uri).ok_or_else(|| format!("No resource {uri}"))?;
    let operation_answer = tool_catalog
        .run_operation_by_id(route.operation_id, operation_input)
        .await?;
    Ok(to_resource_contents(uri, operation_answer))
}

/// The resource a tool's answer lives at, filled from the tool's arguments, when it has one.
pub fn find_answer_uri(operation_ids: &[&str], arguments: &Map<String, Value>) -> Option<String> {
    let route = RESOURCE_ROUTES
        .iter()
        .find(|route| operation_ids.contains(&route.operation_id))?;
    let mut filled_uri = route.uri_template.to_owned();
    for template_segment in route.uri_template.split('/') {
        if let Some(parameter_name) = template_segment
            .strip_prefix('{')
            .and_then(|name| name.strip_suffix('}'))
        {
            let argument_value = arguments.get(&to_snake_case(parameter_name))?;
            let argument_text = argument_value
                .as_str()
                .map_or_else(|| argument_value.to_string(), str::to_owned);
            filled_uri = filled_uri.replace(template_segment, &argument_text);
        }
    }
    Some(filled_uri)
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: AI-03.1
    #[test]
    fn uris_match_their_routes_with_typed_path_values() {
        let (attachment_route, attachment_input) =
            match_resource_uri("sendmock://emails/01ABC/attachments/2")
                .unwrap_or_else(|| panic!("a route"));
        let (skill_route, _) =
            match_resource_uri("sendmock://docs/skill").unwrap_or_else(|| panic!("a route"));

        assert_eq!(
            attachment_route.operation_id,
            "getEmailsByEmailIdAttachmentsByAttachmentIndex"
        );
        assert_eq!(attachment_input["email_id"], "01ABC");
        assert_eq!(attachment_input["attachment_index"], 2);
        assert_eq!(skill_route.operation_id, "getAiSkill");
        assert!(match_resource_uri("sendmock://emails/01ABC/unknown").is_none());
    }

    // AC: AI-03.1
    #[test]
    fn every_route_reads_an_operation_of_the_registry() {
        let operation_ids: Vec<&str> = sendmock_ops::build_operation_registry()
            .operations()
            .iter()
            .map(|operation| operation.definition().operation_id)
            .collect();

        for route in RESOURCE_ROUTES {
            assert!(
                operation_ids.contains(&route.operation_id),
                "{}",
                route.operation_id
            );
        }
        assert_eq!(
            find_answer_uri(
                &["getEmailsByEmailIdRaw"],
                &serde_json::from_value(serde_json::json!({ "email_id": "01ABC" }))
                    .unwrap_or_default()
            ),
            Some("sendmock://emails/01ABC/raw".to_owned())
        );
    }
}
