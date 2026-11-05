//! Amounts are kept in a currency's minor units (cents, paisa); a few currencies have none.

/// Currencies without minor units, as ISO 4217 and Stripe list them.
const ZERO_DECIMAL_CURRENCIES: [&str; 15] = [
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV",
    "XAF", "XOF",
];

/// Three capital letters, such as `BDT`, `USD` or `JPY`.
pub fn is_currency_code(currency_code: &str) -> bool {
    currency_code.len() == 3
        && currency_code
            .chars()
            .all(|character| character.is_ascii_uppercase())
}

/// How many decimal places the currency's major unit has: 0 for JPY, 2 for BDT, INR, USD, EUR.
pub fn currency_exponent(currency_code: &str) -> u32 {
    if ZERO_DECIMAL_CURRENCIES.contains(&currency_code) {
        0
    } else {
        2
    }
}

/// "1200.00" for 120000 BDT minor units, "500" for 500 JPY.
pub fn format_major_amount(amount_minor: u64, currency_code: &str) -> String {
    let exponent = currency_exponent(currency_code);
    if exponent == 0 {
        return amount_minor.to_string();
    }
    let divisor = 10_u64.pow(exponent);
    format!(
        "{}.{:0width$}",
        amount_minor / divisor,
        amount_minor % divisor,
        width = exponent as usize
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_zero_decimal_currencies_whole() {
        assert_eq!(format_major_amount(120_000, "BDT"), "1200.00");
        assert_eq!(format_major_amount(5, "USD"), "0.05");
        assert_eq!(format_major_amount(500, "JPY"), "500");
        assert!(is_currency_code("INR"));
        assert!(!is_currency_code("usd"));
        assert!(!is_currency_code("EURO"));
    }
}
