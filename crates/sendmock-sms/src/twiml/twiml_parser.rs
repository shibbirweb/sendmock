use std::fmt;

use roxmltree::{Document, Node};

use super::twiml_verb::{TwimlMessage, TwimlMethod, TwimlRedirect, TwimlVerb};

/// Why an answer is not a TwiML document; Twilio reports it as 12100 Document parse failure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TwimlParseError {
    pub reason: String,
}

impl fmt::Display for TwimlParseError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "Document parse failure: {}", self.reason)
    }
}

impl std::error::Error for TwimlParseError {}

/// Reads the `<Message>` and `<Redirect>` verbs of a `<Response>` document, in order. Other
/// verbs are skipped, as SendMock has nothing to do for them.
pub fn parse_twiml(twiml_text: &str) -> Result<Vec<TwimlVerb>, TwimlParseError> {
    let twiml_document = Document::parse(twiml_text).map_err(|parse_error| TwimlParseError {
        reason: parse_error.to_string(),
    })?;
    let response_element = twiml_document.root_element();
    if response_element.tag_name().name() != "Response" {
        return Err(TwimlParseError {
            reason: format!(
                "the root element is <{}>, not <Response>",
                response_element.tag_name().name()
            ),
        });
    }
    Ok(response_element
        .children()
        .filter(Node::is_element)
        .filter_map(read_verb)
        .collect())
}

fn read_verb(verb_element: Node<'_, '_>) -> Option<TwimlVerb> {
    match verb_element.tag_name().name() {
        "Message" => Some(TwimlVerb::Message(read_message(verb_element))),
        "Redirect" => Some(TwimlVerb::Redirect(TwimlRedirect {
            url: read_text(verb_element),
            method: TwimlMethod::from_attribute(verb_element.attribute("method")),
        })),
        _ => None,
    }
}

fn read_message(message_element: Node<'_, '_>) -> TwimlMessage {
    let body_texts = read_child_texts(message_element, "Body");
    let media_urls = read_child_texts(message_element, "Media");
    let has_noun_children = !body_texts.is_empty() || !media_urls.is_empty();
    let read_attribute = |attribute_name: &str| {
        message_element
            .attribute(attribute_name)
            .map(str::trim)
            .filter(|attribute_value| !attribute_value.is_empty())
            .map(str::to_owned)
    };
    TwimlMessage {
        body: if has_noun_children {
            body_texts.join("\n")
        } else {
            read_text(message_element)
        },
        to: read_attribute("to"),
        from: read_attribute("from"),
        status_callback: read_attribute("statusCallback"),
        action: read_attribute("action"),
        method: TwimlMethod::from_attribute(message_element.attribute("method")),
        media_urls,
    }
}

fn read_child_texts(parent_element: Node<'_, '_>, child_name: &str) -> Vec<String> {
    parent_element
        .children()
        .filter(|child_node| child_node.has_tag_name(child_name))
        .map(read_text)
        .collect()
}

/// The element's text, its own and its children's, trimmed.
fn read_text(element: Node<'_, '_>) -> String {
    element
        .descendants()
        .filter(Node::is_text)
        .filter_map(|text_node| text_node.text())
        .collect::<String>()
        .trim()
        .to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read_messages(twiml_text: &str) -> Vec<TwimlMessage> {
        parse_twiml(twiml_text)
            .unwrap_or_default()
            .into_iter()
            .filter_map(|twiml_verb| match twiml_verb {
                TwimlVerb::Message(twiml_message) => Some(twiml_message),
                TwimlVerb::Redirect(_) => None,
            })
            .collect()
    }

    #[test]
    fn reads_a_message_with_its_text_and_attributes() {
        let twiml_messages = read_messages(
            r#"<?xml version="1.0" encoding="UTF-8"?>
            <Response>
              <Message to="+15550002222" from="+15550003333" statusCallback="http://localhost/status"
                       action="http://localhost/next" method="get">Thanks!</Message>
            </Response>"#,
        );
        assert_eq!(
            twiml_messages,
            vec![TwimlMessage {
                body: "Thanks!".to_owned(),
                to: Some("+15550002222".to_owned()),
                from: Some("+15550003333".to_owned()),
                status_callback: Some("http://localhost/status".to_owned()),
                action: Some("http://localhost/next".to_owned()),
                method: TwimlMethod::Get,
                media_urls: Vec::new(),
            }]
        );
    }

    #[test]
    fn reads_body_and_media_nouns() {
        let twiml_messages = read_messages(
            "<Response><Message><Body>Your ticket</Body>\
             <Media>https://example.test/a.png</Media><Media>https://example.test/b.pdf</Media>\
             </Message></Response>",
        );
        assert_eq!(twiml_messages[0].body, "Your ticket");
        assert_eq!(
            twiml_messages[0].media_urls,
            vec!["https://example.test/a.png", "https://example.test/b.pdf"]
        );
        assert_eq!(twiml_messages[0].method, TwimlMethod::Post);
    }

    #[test]
    fn keeps_message_and_redirect_order_and_skips_other_verbs() {
        let twiml_verbs = parse_twiml(
            "<Response><Message>one</Message><Say>ignored</Say>\
             <Redirect method=\"GET\">/next</Redirect><Message>two</Message></Response>",
        )
        .unwrap_or_default();
        assert_eq!(twiml_verbs.len(), 3);
        assert_eq!(
            twiml_verbs[1],
            TwimlVerb::Redirect(TwimlRedirect {
                url: "/next".to_owned(),
                method: TwimlMethod::Get,
            })
        );
    }

    #[test]
    fn an_empty_response_has_no_verbs() {
        assert_eq!(parse_twiml("<Response/>"), Ok(Vec::new()));
    }

    #[test]
    fn refuses_a_document_that_is_not_a_response() {
        assert!(parse_twiml("<Reply><Message>hi</Message></Reply>").is_err());
        assert!(parse_twiml("Thanks!").is_err());
        assert!(parse_twiml("<Response><Message>open").is_err());
    }
}
