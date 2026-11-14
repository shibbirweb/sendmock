//! What a Cloud API message says, as a conversation shows it: every message type read into a
//! text body (and its media), or the `(#100)` reason Meta refuses it with.

use serde_json::Value;

const MEDIA_TYPES: [(&str, &str); 5] = [
    ("image", "Photo"),
    ("video", "Video"),
    ("audio", "Audio"),
    ("document", "Document"),
    ("sticker", "Sticker"),
];
const OTHER_TYPES: [&str; 6] = [
    "text",
    "template",
    "location",
    "contacts",
    "interactive",
    "reaction",
];

/// A message's readable body and the media it carries, by link or by uploaded media id.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct WhatsappContent {
    pub body: String,
    pub media_links: Vec<String>,
    pub media_ids: Vec<String>,
}

impl WhatsappContent {
    fn from_text(body: String) -> Self {
        Self {
            body,
            ..Self::default()
        }
    }
}

fn read_text<'message>(message_object: &'message Value, pointer: &str) -> Option<&'message str> {
    message_object
        .pointer(pointer)
        .and_then(Value::as_str)
        .filter(|text| !text.is_empty())
}

fn require_parameter<'message>(
    message_object: &'message Value,
    message_type: &str,
    pointer: &str,
) -> Result<&'message str, String> {
    read_text(message_object, pointer).ok_or_else(|| {
        let parameter_path = pointer.trim_start_matches('/').replace('/', "']['");
        format!("The parameter {message_type}['{parameter_path}'] is required.")
    })
}

fn read_template(template: &Value) -> Result<WhatsappContent, String> {
    let template_name = require_parameter(template, "template", "/name")?;
    let language_code = require_parameter(template, "template", "/language/code")?;
    let body_parameters: Vec<&str> = template["components"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|component| component["type"].as_str() == Some("body"))
        .flat_map(|component| component["parameters"].as_array().into_iter().flatten())
        .filter_map(|parameter| parameter["text"].as_str())
        .collect();
    let mut body = format!("Template {template_name} ({language_code})");
    if !body_parameters.is_empty() {
        body.push('\n');
        body.push_str(&body_parameters.join(", "));
    }
    Ok(WhatsappContent::from_text(body))
}

fn read_media(media: &Value, media_type: &str, label: &str) -> Result<WhatsappContent, String> {
    let media_link = read_text(media, "/link");
    let media_id = read_text(media, "/id");
    if media_link.is_none() && media_id.is_none() {
        return Err(format!(
            "The parameter {media_type}['link'] or {media_type}['id'] is required."
        ));
    }
    let body = match (read_text(media, "/caption"), read_text(media, "/filename")) {
        (Some(caption), _) => caption.to_owned(),
        (None, Some(filename)) => format!("{label} {filename}"),
        (None, None) => label.to_owned(),
    };
    Ok(WhatsappContent {
        body,
        media_links: media_link.map(str::to_owned).into_iter().collect(),
        media_ids: media_id.map(str::to_owned).into_iter().collect(),
    })
}

fn read_location(location: &Value) -> Result<WhatsappContent, String> {
    let coordinates = ["latitude", "longitude"]
        .iter()
        .map(|coordinate| match &location[*coordinate] {
            Value::Number(number) => Ok(number.to_string()),
            Value::String(text) if !text.is_empty() => Ok(text.clone()),
            _ => Err(format!(
                "The parameter location['{coordinate}'] is required."
            )),
        })
        .collect::<Result<Vec<_>, _>>()?;
    let mut lines: Vec<String> = ["/name", "/address"]
        .iter()
        .filter_map(|pointer| read_text(location, pointer).map(str::to_owned))
        .collect();
    lines.push(coordinates.join(", "));
    Ok(WhatsappContent::from_text(lines.join("\n")))
}

fn read_contacts(contacts: &Value) -> Result<WhatsappContent, String> {
    let contact_lines: Vec<String> = contacts
        .as_array()
        .into_iter()
        .flatten()
        .map(|contact| {
            let contact_name = read_text(contact, "/name/formatted_name").unwrap_or("Contact");
            let phones: Vec<&str> = contact["phones"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|phone| phone["phone"].as_str())
                .collect();
            match phones.as_slice() {
                [] => contact_name.to_owned(),
                _ => format!("{contact_name}: {}", phones.join(", ")),
            }
        })
        .collect();
    if contact_lines.is_empty() {
        return Err("The parameter contacts is required.".to_owned());
    }
    Ok(WhatsappContent::from_text(contact_lines.join("\n")))
}

/// The body text, then each button, list row or call-to-action label on its own line.
fn read_interactive(interactive: &Value) -> Result<WhatsappContent, String> {
    require_parameter(interactive, "interactive", "/type")?;
    let action = &interactive["action"];
    let button_titles = action["buttons"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|button| button.pointer("/reply/title").and_then(Value::as_str));
    let row_titles = action["sections"]
        .as_array()
        .into_iter()
        .flatten()
        .flat_map(|section| section["rows"].as_array().into_iter().flatten())
        .filter_map(|row| row["title"].as_str());
    let call_to_action = read_text(action, "/parameters/display_text");
    let lines: Vec<&str> = read_text(interactive, "/body/text")
        .into_iter()
        .chain(button_titles)
        .chain(row_titles)
        .chain(call_to_action)
        .collect();
    Ok(WhatsappContent::from_text(lines.join("\n")))
}

fn read_reaction(reaction: &Value) -> Result<WhatsappContent, String> {
    require_parameter(reaction, "reaction", "/message_id")?;
    let body = match read_text(reaction, "/emoji") {
        Some(emoji) => format!("Reacted {emoji}"),
        None => "Removed a reaction".to_owned(),
    };
    Ok(WhatsappContent::from_text(body))
}

/// The message's content by its `type`, or the reason Meta refuses it.
pub fn read_whatsapp_content(message: &Value) -> Result<WhatsappContent, String> {
    let message_type = message["type"].as_str().unwrap_or("text");
    let type_object = &message[message_type];
    if let Some((_, label)) = MEDIA_TYPES
        .iter()
        .find(|(media_type, _)| *media_type == message_type)
    {
        return read_media(type_object, message_type, label);
    }
    if !OTHER_TYPES.contains(&message_type) {
        return Err(format!("Param type must be one of {{{}}}.", list_types()));
    }
    if type_object.is_null() {
        return Err(format!("The parameter {message_type} is required."));
    }
    match message_type {
        "text" => require_parameter(type_object, "text", "/body")
            .map(|body| WhatsappContent::from_text(body.to_owned())),
        "template" => read_template(type_object),
        "location" => read_location(type_object),
        "contacts" => read_contacts(type_object),
        "interactive" => read_interactive(type_object),
        _ => read_reaction(type_object),
    }
}

fn list_types() -> String {
    OTHER_TYPES
        .iter()
        .chain(MEDIA_TYPES.iter().map(|(media_type, _)| media_type))
        .copied()
        .collect::<Vec<_>>()
        .join(", ")
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    // AC: SM-18.1
    #[test]
    fn each_message_type_reads_as_a_conversation_shows_it() {
        let template = json!({ "type": "template", "template": {
            "name": "order_update", "language": { "code": "en_US" },
            "components": [{ "type": "body", "parameters": [{ "type": "text", "text": "1042" }] }],
        } });
        let location = json!({ "type": "location", "location": { "latitude": 23.81, "longitude": 90.41, "name": "Shop" } });
        let interactive = json!({ "type": "interactive", "interactive": {
            "type": "button", "body": { "text": "Confirm the order?" },
            "action": { "buttons": [{ "type": "reply", "reply": { "id": "y", "title": "Yes" } }] },
        } });
        let image = json!({ "type": "image", "image": { "link": "https://shop.test/a.png" } });

        assert_eq!(
            read_whatsapp_content(&template).map(|content| content.body),
            Ok("Template order_update (en_US)\n1042".to_owned())
        );
        assert_eq!(
            read_whatsapp_content(&location).map(|content| content.body),
            Ok("Shop\n23.81, 90.41".to_owned())
        );
        assert_eq!(
            read_whatsapp_content(&interactive).map(|content| content.body),
            Ok("Confirm the order?\nYes".to_owned())
        );
        assert_eq!(
            read_whatsapp_content(&image).map(|content| content.media_links),
            Ok(vec!["https://shop.test/a.png".to_owned()])
        );
    }

    // AC: SM-18.2
    #[test]
    fn a_message_without_its_required_field_or_with_an_unknown_type_is_refused() {
        let no_body = json!({ "type": "text", "text": {} });
        let unknown_type = json!({ "type": "hologram" });
        let media_without_source =
            json!({ "type": "document", "document": { "caption": "Invoice" } });

        assert_eq!(
            read_whatsapp_content(&no_body),
            Err("The parameter text['body'] is required.".to_owned())
        );
        assert!(
            read_whatsapp_content(&unknown_type)
                .is_err_and(|reason| reason.starts_with("Param type must be one of"))
        );
        assert_eq!(
            read_whatsapp_content(&media_without_source),
            Err("The parameter document['link'] or document['id'] is required.".to_owned())
        );
    }
}
