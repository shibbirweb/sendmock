use std::collections::BTreeMap;

use serde_json::Value;

use super::stripe_error::StripeError;

/// A Stripe request's parameters, decoded from its form body or query.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct StripeFields {
    decoded_form: Value,
}

impl StripeFields {
    pub fn new(decoded_form: Value) -> Self {
        Self { decoded_form }
    }

    /// The value at a path such as `["payment_intent_data", "capture_method"]`.
    pub fn find(&self, field_path: &[&str]) -> Option<&Value> {
        field_path
            .iter()
            .try_fold(&self.decoded_form, |parent_value, field_name| {
                match (parent_value, field_name.parse::<usize>()) {
                    (Value::Array(entries), Ok(entry_index)) => entries.get(entry_index),
                    _ => parent_value.get(field_name),
                }
            })
    }

    /// A text parameter; an empty one counts as not sent, as Stripe treats it.
    pub fn text(&self, field_path: &[&str]) -> Option<String> {
        self.find(field_path)
            .and_then(Value::as_str)
            .filter(|field_text| !field_text.is_empty())
            .map(str::to_owned)
    }

    pub fn required_text(&self, field_path: &[&str]) -> Result<String, StripeError> {
        self.text(field_path)
            .ok_or_else(|| StripeError::missing_param(&describe_param(field_path)))
    }

    /// A whole number of minor units above 0, when sent.
    pub fn positive_amount(&self, field_path: &[&str]) -> Result<Option<u64>, StripeError> {
        let Some(amount_text) = self.text(field_path) else {
            return Ok(None);
        };
        match amount_text.parse::<u64>() {
            Ok(amount_minor) if amount_minor > 0 => Ok(Some(amount_minor)),
            Ok(_) => Err(StripeError::invalid_value(
                &describe_param(field_path),
                "This value must be greater than or equal to 1.",
            )),
            Err(_) => Err(StripeError::invalid_integer(
                &describe_param(field_path),
                &amount_text,
            )),
        }
    }

    pub fn is_true(&self, field_path: &[&str]) -> bool {
        self.text(field_path).as_deref() == Some("true")
    }

    /// A `metadata[...]` object as text keys and values; anything else is left out.
    pub fn metadata(&self, field_path: &[&str]) -> BTreeMap<String, String> {
        self.find(field_path)
            .and_then(Value::as_object)
            .map(|metadata_object| {
                metadata_object
                    .iter()
                    .filter_map(|(metadata_key, metadata_value)| {
                        metadata_value
                            .as_str()
                            .map(|metadata_text| (metadata_key.clone(), metadata_text.to_owned()))
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Every text value sent anywhere under the path, e.g. a raw card's fields.
    pub fn collect_texts(&self, field_path: &[&str]) -> Vec<String> {
        let mut collected_texts = Vec::new();
        if let Some(found_value) = self.find(field_path) {
            collect_texts_into(found_value, &mut collected_texts);
        }
        collected_texts
    }
}

fn collect_texts_into(found_value: &Value, collected_texts: &mut Vec<String>) {
    match found_value {
        Value::String(field_text) if !field_text.is_empty() => {
            collected_texts.push(field_text.clone());
        }
        Value::Array(entries) => entries
            .iter()
            .for_each(|entry| collect_texts_into(entry, collected_texts)),
        Value::Object(entries) => entries
            .values()
            .for_each(|entry| collect_texts_into(entry, collected_texts)),
        _ => {}
    }
}

/// A path as Stripe names a parameter: `line_items[0][quantity]`.
pub fn describe_param(field_path: &[&str]) -> String {
    let Some((first_name, rest_names)) = field_path.split_first() else {
        return String::new();
    };
    rest_names
        .iter()
        .fold((*first_name).to_owned(), |param_name, field_name| {
            format!("{param_name}[{field_name}]")
        })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn reads_nested_texts_amounts_and_metadata() {
        let stripe_fields = StripeFields::new(json!({
            "amount": "2000",
            "confirm": "true",
            "description": "",
            "metadata": {"order_id": "7"},
            "payment_method_data": {"card": {"number": "4242", "cvc": "123"}},
        }));

        assert_eq!(stripe_fields.positive_amount(&["amount"]), Ok(Some(2000)));
        assert!(stripe_fields.is_true(&["confirm"]));
        assert_eq!(stripe_fields.text(&["description"]), None);
        assert_eq!(
            stripe_fields.metadata(&["metadata"]),
            BTreeMap::from([("order_id".to_owned(), "7".to_owned())])
        );
        assert_eq!(
            stripe_fields.collect_texts(&["payment_method_data"]),
            vec!["123".to_owned(), "4242".to_owned()]
        );
    }

    #[test]
    fn refuses_an_amount_that_is_not_a_positive_integer() {
        let stripe_fields = StripeFields::new(json!({"amount": "12.5", "zero": "0"}));

        assert_eq!(
            stripe_fields.positive_amount(&["amount"]),
            Err(StripeError::invalid_integer("amount", "12.5"))
        );
        assert!(stripe_fields.positive_amount(&["zero"]).is_err());
        assert_eq!(
            stripe_fields.required_text(&["line_items", "0", "quantity"]),
            Err(StripeError::missing_param("line_items[0][quantity]"))
        );
    }
}
