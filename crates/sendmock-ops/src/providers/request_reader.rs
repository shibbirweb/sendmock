use serde_json::{Map, Value};

use super::provider_http::ProviderHttpRequest;

/// The request's fields as one value: the query string, overlaid by a JSON or form body. The
/// `Content-Type` wins over the operation's declared format, since providers accept both.
/// `None` when a JSON body does not parse.
pub fn read_request_fields(request: &ProviderHttpRequest, request_format: &str) -> Option<Value> {
    let mut request_fields = read_form_fields(
        request
            .query_string
            .as_deref()
            .unwrap_or_default()
            .as_bytes(),
    );
    let content_type = request
        .header("content-type")
        .unwrap_or_default()
        .to_ascii_lowercase();
    let is_json_body = content_type.contains("json")
        || (!content_type.contains("form") && request_format == "json");
    if request.body.iter().all(u8::is_ascii_whitespace) {
        return Some(Value::Object(request_fields));
    }
    if is_json_body {
        return match serde_json::from_slice::<Value>(&request.body).ok()? {
            Value::Object(body_fields) => {
                request_fields.extend(body_fields);
                Some(Value::Object(request_fields))
            }
            other_body => Some(other_body),
        };
    }
    request_fields.extend(read_form_fields(&request.body));
    Some(Value::Object(request_fields))
}

/// `a=1&b=2&b=3` as `{"a": "1", "b": ["2", "3"]}`.
fn read_form_fields(form_bytes: &[u8]) -> Map<String, Value> {
    let mut form_fields = Map::new();
    let pairs: Vec<(String, String)> = serde_urlencoded::from_bytes(form_bytes).unwrap_or_default();
    for (field_name, field_value) in pairs {
        match form_fields.get_mut(&field_name) {
            Some(Value::Array(existing_values)) => existing_values.push(Value::from(field_value)),
            Some(existing_value) => {
                let first_value = existing_value.take();
                *existing_value = Value::Array(vec![first_value, Value::from(field_value)]);
            }
            None => {
                form_fields.insert(field_name, Value::from(field_value));
            }
        }
    }
    form_fields
}

/// Every non-empty value a mapping source reads: `a.b[0].c`, `a[*]`, `content[type=text/plain]`,
/// or `h:*` for each field starting with `h:`.
pub fn read_source_values(request_fields: &Value, source_path: &str) -> Vec<String> {
    if let Some(field_prefix) = source_path.strip_suffix('*')
        && !source_path.contains('[')
    {
        return request_fields
            .as_object()
            .map(|fields| {
                fields
                    .iter()
                    .filter(|(field_name, _)| field_name.starts_with(field_prefix))
                    .map(|(field_name, field_value)| {
                        format!("{field_name}: {}", to_text(field_value))
                    })
                    .collect()
            })
            .unwrap_or_default();
    }
    let mut current_values = vec![request_fields];
    for path_step in split_source_path(source_path) {
        current_values = current_values
            .into_iter()
            .flat_map(|current_value| step_into(current_value, &path_step))
            .collect();
    }
    let mut text_values = Vec::new();
    collect_text_values(&current_values, &mut text_values);
    text_values
}

fn split_source_path(source_path: &str) -> Vec<String> {
    source_path
        .replace('[', ".[")
        .split('.')
        .filter(|path_step| !path_step.is_empty())
        .map(str::to_owned)
        .collect()
}

fn step_into<'value>(current_value: &'value Value, path_step: &str) -> Vec<&'value Value> {
    let Some(selector) = path_step
        .strip_prefix('[')
        .and_then(|rest| rest.strip_suffix(']'))
    else {
        return current_value.get(path_step).into_iter().collect();
    };
    let list_items: &[Value] = current_value.as_array().map_or(&[], Vec::as_slice);
    if selector == "*" {
        return list_items.iter().collect();
    }
    if let Ok(item_index) = selector.parse::<usize>() {
        return list_items.get(item_index).into_iter().collect();
    }
    let (selector_field, selector_value) = selector.split_once('=').unwrap_or((selector, ""));
    list_items
        .iter()
        .filter(|list_item| {
            list_item.get(selector_field).map(to_text).as_deref() == Some(selector_value)
        })
        .collect()
}

fn collect_text_values(read_values: &[&Value], text_values: &mut Vec<String>) {
    for read_value in read_values {
        match read_value {
            Value::Array(items) => {
                collect_text_values(&items.iter().collect::<Vec<_>>(), text_values)
            }
            Value::Null => {}
            Value::String(text) if text.is_empty() => {}
            other_value => text_values.push(to_text(other_value)),
        }
    }
}

fn to_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other_value => other_value.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use serde_json::json;

    use super::*;

    fn form_request(body: &str) -> ProviderHttpRequest {
        ProviderHttpRequest {
            method: "POST".to_owned(),
            path: "/sms/json".to_owned(),
            query_string: Some("api_key=k".to_owned()),
            headers: BTreeMap::from([(
                "content-type".to_owned(),
                "application/x-www-form-urlencoded".to_owned(),
            )]),
            body: body.as_bytes().to_vec(),
        }
    }

    #[test]
    fn form_fields_repeat_into_lists_and_join_the_query_string() {
        let request_fields =
            read_request_fields(&form_request("To=%2B1555&MediaUrl=a&MediaUrl=b"), "form");

        assert_eq!(
            request_fields,
            Some(json!({ "api_key": "k", "To": "+1555", "MediaUrl": ["a", "b"] }))
        );
    }

    #[test]
    fn a_json_content_type_wins_over_the_declared_format() {
        let mut json_request = form_request(r#"{"to": "447700900000", "text": "Hi"}"#);
        json_request
            .headers
            .insert("content-type".to_owned(), "application/json".to_owned());

        assert_eq!(
            read_request_fields(&json_request, "form")
                .and_then(|fields| fields.get("text").cloned()),
            Some(json!("Hi"))
        );
        json_request.body = b"{not json".to_vec();
        assert_eq!(read_request_fields(&json_request, "form"), None);
    }

    #[test]
    fn sources_read_paths_lists_and_selectors() {
        let request_fields = json!({
            "personalizations": [{ "to": [{ "email": "a@x.test" }, { "email": "b@x.test" }] }],
            "content": [{ "type": "text/plain", "value": "Hi" }, { "type": "text/html", "value": "<b>Hi</b>" }],
            "h:X-Tag": "one",
        });

        assert_eq!(
            read_source_values(&request_fields, "personalizations[0].to[*].email"),
            vec!["a@x.test", "b@x.test"]
        );
        assert_eq!(
            read_source_values(&request_fields, "content[type=text/html].value"),
            vec!["<b>Hi</b>"]
        );
        assert_eq!(
            read_source_values(&request_fields, "h:*"),
            vec!["h:X-Tag: one"]
        );
        assert!(read_source_values(&request_fields, "missing").is_empty());
    }
}
