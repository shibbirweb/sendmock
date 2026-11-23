//! What a webhook template reads about an SMS beyond the message as lists show it.

use sendmock_sms::find_number_country;
use serde_json::Value;

/// Adds `from_country` and `to_country`, each number's ISO country from its calling code or
/// empty, so Twilio's `FromCountry` and `ToCountry` are filled as Twilio fills them.
pub fn add_number_countries(message_data: &mut Value) {
    let Some(message_fields) = message_data.as_object_mut() else {
        return;
    };
    for (number_field, country_field) in
        [("from_number", "from_country"), ("to_number", "to_country")]
    {
        let number_country = message_fields
            .get(number_field)
            .and_then(Value::as_str)
            .and_then(find_number_country)
            .unwrap_or_default();
        message_fields.insert(country_field.to_owned(), Value::from(number_country));
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    // AC: SM-22.2
    #[test]
    fn each_number_gets_its_country_or_an_empty_one() {
        let mut message_data =
            json!({ "from_number": "+447700900123", "to_number": "+8613800000000" });

        add_number_countries(&mut message_data);

        assert_eq!(message_data["from_country"], "GB");
        assert_eq!(message_data["to_country"], "");
    }
}
