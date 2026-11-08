use std::collections::BTreeMap;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use schemars::JsonSchema;
use sendmock_mail::{NativeAttachment, NativeMessage, guess_content_type};
use serde::Deserialize;

use crate::OperationError;

/// The most attachment bytes one native send takes, like SMTP's default message size.
pub const MAXIMUM_ATTACHMENT_BYTES: usize = 25 * 1024 * 1024;

/// One file in `attachments` of POST /api/v1/send.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct NativeSendAttachment {
    /// The file name the recipient sees.
    pub filename: String,
    /// The file bytes, base64 encoded.
    pub content: String,
    /// Guessed from the file extension when missing.
    pub content_type: Option<String>,
    /// Makes the attachment inline, shown in the HTML with `cid:<content_id>`.
    pub content_id: Option<String>,
}

/// Body of POST /api/v1/send (native HTTP send API).
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct NativeSendRequest {
    /// The sender, as an address or `Name <address>`.
    pub from: String,
    /// The recipients.
    pub to: Vec<String>,
    /// Copy recipients.
    pub cc: Option<Vec<String>>,
    /// Hidden copy recipients; stored with the email but not in its headers.
    pub bcc: Option<Vec<String>>,
    /// The subject line.
    pub subject: String,
    /// The plain-text body. Send `text`, `html` or both.
    pub text: Option<String>,
    /// The HTML body. Send `text`, `html` or both.
    pub html: Option<String>,
    /// Extra headers, by name.
    pub headers: Option<BTreeMap<String, String>>,
    /// Tags to file the email under in Mail.
    pub tags: Option<Vec<String>>,
    /// Files to attach.
    pub attachments: Option<Vec<NativeSendAttachment>>,
}

/// The address of `Name <address>`, or the text itself.
pub fn read_bare_address(address_text: &str) -> String {
    match (address_text.rfind('<'), address_text.rfind('>')) {
        (Some(open_position), Some(close_position)) if open_position < close_position => {
            address_text[open_position + 1..close_position]
                .trim()
                .to_owned()
        }
        _ => address_text.trim().to_owned(),
    }
}

fn field_error(field_name: &str, message: &str) -> OperationError {
    OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(field_name.to_owned()),
    }
}

impl NativeSendRequest {
    /// Checks every field and builds the message, or names the first field that is wrong.
    pub fn to_native_message(&self) -> Result<NativeMessage, OperationError> {
        if !read_bare_address(&self.from).contains('@') {
            return Err(field_error(
                "from",
                "`from` must be an email address, such as Shop <no-reply@shop.test>",
            ));
        }
        if self.to.is_empty() {
            return Err(field_error("to", "`to` needs at least one recipient"));
        }
        let recipient_lists = [
            ("to", Some(&self.to)),
            ("cc", self.cc.as_ref()),
            ("bcc", self.bcc.as_ref()),
        ];
        for (field_name, recipients) in recipient_lists {
            if let Some(invalid_recipient) = recipients
                .into_iter()
                .flatten()
                .find(|recipient| !read_bare_address(recipient).contains('@'))
            {
                return Err(field_error(
                    field_name,
                    &format!("{invalid_recipient} in `{field_name}` is not an email address"),
                ));
            }
        }
        if self.text.is_none() && self.html.is_none() {
            return Err(field_error(
                "text",
                "Send a `text` body, an `html` body or both",
            ));
        }
        Ok(NativeMessage {
            from: self.from.clone(),
            to: self.to.clone(),
            cc: self.cc.clone().unwrap_or_default(),
            subject: self.subject.clone(),
            text: self.text.clone(),
            html: self.html.clone(),
            headers: self
                .headers
                .clone()
                .unwrap_or_default()
                .into_iter()
                .collect(),
            attachments: self.decode_attachments()?,
        })
    }

    /// Every envelope recipient: To, Cc and Bcc addresses.
    pub fn envelope_recipients(&self) -> Vec<String> {
        self.to
            .iter()
            .chain(self.cc.iter().flatten())
            .chain(self.bcc.iter().flatten())
            .map(|recipient| read_bare_address(recipient))
            .collect()
    }

    fn decode_attachments(&self) -> Result<Vec<NativeAttachment>, OperationError> {
        let mut total_bytes = 0_usize;
        let mut native_attachments = Vec::new();
        for (attachment_position, attachment) in self.attachments.iter().flatten().enumerate() {
            let attachment_field = format!("attachments[{attachment_position}]");
            if attachment.filename.trim().is_empty() {
                return Err(field_error(
                    &format!("{attachment_field}.filename"),
                    &format!("{attachment_field} needs a filename"),
                ));
            }
            let content = BASE64.decode(attachment.content.trim()).map_err(|_| {
                field_error(
                    &format!("{attachment_field}.content"),
                    &format!("{} is not valid base64", attachment.filename),
                )
            })?;
            total_bytes += content.len();
            if total_bytes > MAXIMUM_ATTACHMENT_BYTES {
                return Err(field_error(
                    &attachment_field,
                    &format!(
                        "{} goes over the 25 MB attachment limit",
                        attachment.filename
                    ),
                ));
            }
            native_attachments.push(NativeAttachment {
                content_type: attachment
                    .content_type
                    .clone()
                    .unwrap_or_else(|| guess_content_type(&attachment.filename)),
                filename: attachment.filename.clone(),
                content_id: attachment.content_id.clone(),
                content,
            });
        }
        Ok(native_attachments)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn order_request() -> NativeSendRequest {
        NativeSendRequest {
            from: "Shop <no-reply@shop.test>".to_owned(),
            to: vec!["Sam <sam@example.test>".to_owned()],
            cc: None,
            bcc: Some(vec!["audit@shop.test".to_owned()]),
            subject: "Order".to_owned(),
            text: Some("Shipped".to_owned()),
            html: None,
            headers: None,
            tags: None,
            attachments: Some(vec![NativeSendAttachment {
                filename: "invoice.pdf".to_owned(),
                content: "JVBERi0xLjQK".to_owned(),
                content_type: None,
                content_id: None,
            }]),
        }
    }

    fn failing_field(native_send_request: &NativeSendRequest) -> Option<String> {
        match native_send_request.to_native_message() {
            Err(OperationError::InvalidInput { field, .. }) => field,
            _ => None,
        }
    }

    #[test]
    fn guesses_attachment_types_and_lists_every_envelope_recipient() -> Result<(), OperationError> {
        let native_message = order_request().to_native_message()?;

        assert_eq!(
            native_message.attachments[0].content_type,
            "application/pdf"
        );
        assert_eq!(native_message.attachments[0].content, b"%PDF-1.4\n");
        assert_eq!(
            order_request().envelope_recipients(),
            ["sam@example.test", "audit@shop.test"]
        );
        Ok(())
    }

    // AC: EM-07.2
    #[test]
    fn names_the_field_that_is_wrong() {
        let mut without_body = order_request();
        without_body.text = None;
        let mut bad_sender = order_request();
        bad_sender.from = "nobody".to_owned();

        assert_eq!(failing_field(&without_body).as_deref(), Some("text"));
        assert_eq!(failing_field(&bad_sender).as_deref(), Some("from"));
    }

    // AC: EM-07.5
    #[test]
    fn names_the_attachment_that_is_wrong() {
        let mut bad_content = order_request();
        if let Some(attachments) = bad_content.attachments.as_mut() {
            attachments[0].content = "not base64!".to_owned();
        }
        let mut no_filename = order_request();
        if let Some(attachments) = no_filename.attachments.as_mut() {
            attachments[0].filename = " ".to_owned();
        }

        assert_eq!(
            failing_field(&bad_content).as_deref(),
            Some("attachments[0].content")
        );
        assert_eq!(
            failing_field(&no_filename).as_deref(),
            Some("attachments[0].filename")
        );
    }
}
