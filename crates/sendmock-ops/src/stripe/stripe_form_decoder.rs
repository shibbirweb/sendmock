use serde_json::{Map, Value};

/// A key such as `line_items[0][price_data][currency]` as its parts; `[]` is an empty part.
fn split_bracketed_key(form_key: &str) -> Vec<String> {
    let Some((first_part, rest)) = form_key.split_once('[') else {
        return vec![form_key.to_owned()];
    };
    let mut key_parts = vec![first_part.to_owned()];
    key_parts.extend(rest.trim_end_matches(']').split("][").map(str::to_owned));
    key_parts
}

fn insert_form_value(
    form_object: &mut Map<String, Value>,
    key_parts: &[String],
    form_value: String,
) {
    let Some((first_part, rest_parts)) = key_parts.split_first() else {
        return;
    };
    let entry_key = if first_part.is_empty() {
        form_object.len().to_string()
    } else {
        first_part.clone()
    };
    if rest_parts.is_empty() {
        form_object.insert(entry_key, Value::String(form_value));
        return;
    }
    let child = form_object
        .entry(entry_key)
        .or_insert_with(|| Value::Object(Map::new()));
    if let Value::Object(child_object) = child {
        insert_form_value(child_object, rest_parts, form_value);
    }
}

/// Objects keyed only by indexes become arrays in index order.
fn convert_indexed_objects(form_value: Value) -> Value {
    let Value::Object(form_object) = form_value else {
        return form_value;
    };
    let is_indexed = !form_object.is_empty()
        && form_object
            .keys()
            .all(|entry_key| entry_key.parse::<usize>().is_ok());
    if !is_indexed {
        return Value::Object(
            form_object
                .into_iter()
                .map(|(entry_key, entry_value)| (entry_key, convert_indexed_objects(entry_value)))
                .collect(),
        );
    }
    let mut indexed_entries: Vec<(usize, Value)> = form_object
        .into_iter()
        .filter_map(|(entry_key, entry_value)| {
            entry_key
                .parse::<usize>()
                .ok()
                .map(|entry_index| (entry_index, convert_indexed_objects(entry_value)))
        })
        .collect();
    indexed_entries.sort_by_key(|(entry_index, _)| *entry_index);
    Value::Array(
        indexed_entries
            .into_iter()
            .map(|(_, entry_value)| entry_value)
            .collect(),
    )
}

/// Stripe's form encoding (`metadata[order_id]=7`, `payment_method_types[]=card`,
/// `line_items[0][quantity]=1`) as a JSON object of strings, arrays and objects.
pub fn decode_stripe_form(form_bytes: &[u8]) -> Value {
    let form_pairs: Vec<(String, String)> =
        serde_urlencoded::from_bytes(form_bytes).unwrap_or_default();
    let mut form_object = Map::new();
    for (form_key, form_value) in form_pairs {
        insert_form_value(
            &mut form_object,
            &split_bracketed_key(&form_key),
            form_value,
        );
    }
    convert_indexed_objects(Value::Object(form_object))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn decodes_stripe_bracketed_keys_into_objects_and_arrays() {
        let form_body = "mode=payment&metadata[order_id]=7&payment_method_types[]=card\
            &payment_method_types[]=link&line_items[1][quantity]=2\
            &line_items[0][price_data][currency]=usd&line_items[0][quantity]=1\
            &line_items[1][price_data][currency]=usd&expand[0]=payment_intent";

        let decoded_form = decode_stripe_form(form_body.as_bytes());

        assert_eq!(
            decoded_form,
            json!({
                "mode": "payment",
                "metadata": {"order_id": "7"},
                "payment_method_types": ["card", "link"],
                "line_items": [
                    {"price_data": {"currency": "usd"}, "quantity": "1"},
                    {"price_data": {"currency": "usd"}, "quantity": "2"},
                ],
                "expand": ["payment_intent"],
            })
        );
    }

    #[test]
    fn decodes_an_empty_or_unreadable_body_as_an_empty_object() {
        assert_eq!(decode_stripe_form(b""), json!({}));
    }
}
