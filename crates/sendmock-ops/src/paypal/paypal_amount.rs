use sendmock_payments::{currency_exponent, format_major_amount, is_currency_code};
use serde_json::{Value, json};

use super::paypal_error::{PayPalApi, PayPalError};

/// An amount in PayPal's shape: `{"currency_code": "USD", "value": "12.00"}`.
pub fn describe_amount(amount_minor: u64, currency: &str) -> Value {
    json!({
        "currency_code": currency,
        "value": format_major_amount(amount_minor, currency),
    })
}

fn read_currency(
    amount: &Value,
    field: &str,
    paypal_api: PayPalApi,
) -> Result<String, PayPalError> {
    let currency_field = format!("{field}/currency_code");
    let currency = amount
        .get("currency_code")
        .and_then(Value::as_str)
        .ok_or_else(|| PayPalError::missing_field(paypal_api, &currency_field))?;
    if !is_currency_code(currency) {
        return Err(PayPalError::invalid_request(
            paypal_api,
            &currency_field,
            Some(currency),
            "INVALID_CURRENCY_CODE",
            "Currency code is invalid or is not currently supported.",
        ));
    }
    Ok(currency.to_owned())
}

/// `"12.30"` in minor units, refusing more decimals than the currency has.
fn parse_value_minor(value_text: &str, currency: &str) -> Option<u64> {
    let decimal_count = usize::try_from(currency_exponent(currency)).unwrap_or(2);
    let (whole_text, fraction_text) = value_text.split_once('.').unwrap_or((value_text, ""));
    let is_well_formed = !whole_text.is_empty()
        && whole_text.chars().all(|digit| digit.is_ascii_digit())
        && fraction_text.chars().all(|digit| digit.is_ascii_digit())
        && fraction_text.len() <= decimal_count
        && !(value_text.contains('.') && fraction_text.is_empty());
    if !is_well_formed {
        return None;
    }
    let padded_fraction = format!("{fraction_text:0<decimal_count$}");
    format!("{whole_text}{padded_fraction}").parse().ok()
}

/// An amount object's value in minor units and its currency; `field` is its JSON pointer.
pub fn parse_amount(
    amount: &Value,
    field: &str,
    paypal_api: PayPalApi,
) -> Result<(u64, String), PayPalError> {
    if !amount.is_object() {
        return Err(PayPalError::missing_field(paypal_api, field));
    }
    let currency = read_currency(amount, field, paypal_api)?;
    let value_field = format!("{field}/value");
    let value_text = amount
        .get("value")
        .and_then(Value::as_str)
        .ok_or_else(|| PayPalError::missing_field(paypal_api, &value_field))?;
    let amount_minor = parse_value_minor(value_text, &currency).ok_or_else(|| {
        PayPalError::invalid_request(
            paypal_api,
            &value_field,
            Some(value_text),
            "DECIMAL_PRECISION",
            "If the currency supports decimals, only two decimal place precision is supported.",
        )
    })?;
    if amount_minor == 0 {
        return Err(PayPalError::unprocessable(
            paypal_api,
            "CANNOT_BE_ZERO_OR_NEGATIVE",
            "Must be greater than zero. If the currency supports decimals, only two decimal place precision is supported.",
        ));
    }
    Ok((amount_minor, currency))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_decimal_value_in_minor_units() {
        let parsed = parse_amount(
            &json!({"currency_code": "USD", "value": "12.3"}),
            "/amount",
            PayPalApi::Orders,
        );

        assert_eq!(parsed, Ok((1230, "USD".to_owned())));
        assert_eq!(
            describe_amount(1230, "USD"),
            json!({"currency_code": "USD", "value": "12.30"})
        );
    }

    #[test]
    fn refuses_decimals_a_currency_does_not_have_and_a_zero_amount() {
        let too_precise = parse_amount(
            &json!({"currency_code": "JPY", "value": "100.5"}),
            "/amount",
            PayPalApi::Orders,
        );
        let zero = parse_amount(
            &json!({"currency_code": "USD", "value": "0.00"}),
            "/amount",
            PayPalApi::Orders,
        );

        assert_eq!(
            too_precise.map_err(|paypal_error| paypal_error.body["details"][0]["issue"].clone()),
            Err(json!("DECIMAL_PRECISION"))
        );
        assert_eq!(zero.map_err(|paypal_error| paypal_error.status), Err(422));
    }
}
