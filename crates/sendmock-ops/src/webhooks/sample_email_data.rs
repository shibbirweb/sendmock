//! The email a preview renders against when none is stored yet. It has every field a stored
//! email gives a template (the bodies, headers, attachments and reply fields too), so inbound
//! formats such as `mailgun.routes` render without errors before any mail arrives.

use serde_json::{Value, json};

pub fn build_sample_email_data() -> Value {
    json!({
        "id": "01JB7T9Q2R5W8X3Y6Z1A4B7C9D",
        "received_at": "2026-01-01T09:00:00Z",
        "from": { "name": "Acme", "address": "no-reply@acme.test" },
        "to": [{ "name": "Ann Lee", "address": "ann@example.com" }],
        "cc": [],
        "subject": "Your Acme sign-in code",
        "snippet": "Your code is 482913. It expires in 10 minutes.",
        "message_id": "<01JB7T9Q2R5W8X3Y6Z1A4B7C9D@acme.test>",
        "recipient": "ann@example.com",
        "in_reply_to": "",
        "references": "",
        "text_body": "Your code is 482913. It expires in 10 minutes.\n\n-- \nAcme",
        "html_body": "<p>Your code is <strong>482913</strong>. It expires in 10 minutes.</p>",
        "stripped_text": "Your code is 482913. It expires in 10 minutes.",
        "stripped_signature": "Acme",
        "headers": {
            "From": ["Acme <no-reply@acme.test>"],
            "To": ["Ann Lee <ann@example.com>"],
            "Subject": ["Your Acme sign-in code"],
            "Message-ID": ["<01JB7T9Q2R5W8X3Y6Z1A4B7C9D@acme.test>"],
        },
        "header_pairs": [
            ["From", "Acme <no-reply@acme.test>"],
            ["To", "Ann Lee <ann@example.com>"],
            ["Subject", "Your Acme sign-in code"],
            ["Message-ID", "<01JB7T9Q2R5W8X3Y6Z1A4B7C9D@acme.test>"],
        ],
        "content_id_map": {},
        "message_url": "",
        "size_bytes": 2048,
        "attachment_count": 0,
        "attachments": [],
        "is_read": false,
        "tags": [],
        "source": "smtp",
        "delivery_status": null,
        "open_count": 0,
        "has_otp": true,
        "direction": "inbound",
        "response_kind": null,
        "provider_message_id": null,
        "user_variables": {},
        "template_id": null,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_sample_email_has_the_bodies_headers_and_attachments_inbound_formats_read() {
        let sample_email = build_sample_email_data();

        for field_name in [
            "message_id",
            "text_body",
            "html_body",
            "header_pairs",
            "content_id_map",
            "attachments",
            "stripped_text",
            "stripped_signature",
            "user_variables",
        ] {
            assert!(
                sample_email.get(field_name).is_some(),
                "the sample has no {field_name}"
            );
        }
    }
}
