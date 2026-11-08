//! An endpoint's extra headers and body fields written into its template, for Template mode
//! and for "Save as template": a JSON body gains the fields before its last `}`, a form body
//! gains `&name=value` pairs. The values stay templates, rendered with the body.

use std::collections::BTreeMap;

use super::template_view::TemplateDraft;

/// `"name": "value"` lines; the value is quoted so it renders escaped inside the JSON string.
fn fold_json_fields(body_template: &str, extra_fields: &BTreeMap<String, String>) -> String {
    let Some(closing_brace_index) = body_template.rfind('}') else {
        return body_template.to_owned();
    };
    let added_fields_text = extra_fields
        .iter()
        .map(|(field_name, field_value)| {
            format!(
                "  {}: {}",
                serde_json::Value::from(field_name.as_str()),
                serde_json::Value::from(field_value.as_str())
            )
        })
        .collect::<Vec<_>>()
        .join(",\n");
    let body_before_brace = body_template[..closing_brace_index].trim_end();
    let separator = if body_before_brace.ends_with('{') {
        ""
    } else {
        ","
    };
    format!(
        "{body_before_brace}{separator}\n{added_fields_text}\n{}",
        &body_template[closing_brace_index..]
    )
}

/// `&name=value` pairs; the name is URL-encoded, the value stays a template.
fn fold_form_fields(body_template: &str, extra_fields: &BTreeMap<String, String>) -> String {
    let added_pairs = extra_fields
        .iter()
        .map(|(field_name, field_value)| {
            let encoded_name = serde_urlencoded::to_string([(field_name.as_str(), "")])
                .unwrap_or_default()
                .trim_end_matches('=')
                .to_owned();
            format!("{encoded_name}={field_value}")
        })
        .collect::<Vec<_>>()
        .join("&");
    if body_template.is_empty() {
        return added_pairs;
    }
    format!("{body_template}&{added_pairs}")
}

pub fn fold_endpoint_overrides(
    template_draft: &TemplateDraft,
    extra_headers: &BTreeMap<String, String>,
    extra_fields: &BTreeMap<String, String>,
) -> TemplateDraft {
    let body_template = if extra_fields.is_empty() {
        template_draft.body_template.clone()
    } else if template_draft.content_type.contains("json") {
        fold_json_fields(&template_draft.body_template, extra_fields)
    } else {
        fold_form_fields(&template_draft.body_template, extra_fields)
    };
    let mut header_templates = template_draft.header_templates.clone();
    header_templates.extend(extra_headers.clone());
    TemplateDraft {
        header_templates,
        body_template,
        ..template_draft.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::webhooks::endpoint_settings::WebhookHttpMethod;

    fn draft(content_type: &str, body_template: &str) -> TemplateDraft {
        TemplateDraft {
            method: WebhookHttpMethod::Post,
            content_type: content_type.to_owned(),
            header_templates: BTreeMap::new(),
            body_template: body_template.to_owned(),
        }
    }

    fn environment_field() -> BTreeMap<String, String> {
        BTreeMap::from([("environment".to_owned(), "{{ vars.env }}".to_owned())])
    }

    #[test]
    fn json_fields_go_before_the_last_brace() {
        let folded_draft = fold_endpoint_overrides(
            &draft("application/json", "{\n  \"text\": \"hi\"\n}"),
            &BTreeMap::new(),
            &environment_field(),
        );

        assert_eq!(
            folded_draft.body_template,
            "{\n  \"text\": \"hi\",\n  \"environment\": \"{{ vars.env }}\"\n}"
        );
    }

    #[test]
    fn an_empty_json_object_gains_fields_without_a_stray_comma() {
        let folded_draft = fold_endpoint_overrides(
            &draft("application/json", "{}"),
            &BTreeMap::new(),
            &environment_field(),
        );

        assert_eq!(
            folded_draft.body_template,
            "{\n  \"environment\": \"{{ vars.env }}\"\n}"
        );
    }

    #[test]
    fn form_fields_are_appended_with_encoded_names() {
        let extra_fields = BTreeMap::from([("Api Key".to_owned(), "{{ vars.key }}".to_owned())]);

        let folded_draft = fold_endpoint_overrides(
            &draft("application/x-www-form-urlencoded", "To={{ data.to }}"),
            &BTreeMap::new(),
            &extra_fields,
        );

        assert_eq!(
            folded_draft.body_template,
            "To={{ data.to }}&Api+Key={{ vars.key }}"
        );
    }

    #[test]
    fn extra_headers_replace_the_template_headers_of_the_same_name() {
        let mut slack_draft = draft("application/json", "{}");
        slack_draft
            .header_templates
            .insert("X-Source".to_owned(), "template".to_owned());
        let extra_headers = BTreeMap::from([("X-Source".to_owned(), "endpoint".to_owned())]);

        let folded_draft = fold_endpoint_overrides(&slack_draft, &extra_headers, &BTreeMap::new());

        assert_eq!(folded_draft.header_templates["X-Source"], "endpoint");
    }
}
