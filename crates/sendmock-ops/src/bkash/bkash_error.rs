use serde_json::{Value, json};

/// A bKash refusal: the code and message bKash answers with status `200`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BkashError {
    pub status_code: &'static str,
    pub status_message: &'static str,
}

impl BkashError {
    pub const INVALID_APP_KEY: Self = Self::new("2001", "Invalid App Key");
    pub const INVALID_PAYMENT_ID: Self = Self::new("2002", "Invalid Payment ID");
    pub const INVALID_AMOUNT: Self = Self::new("2006", "Invalid Amount");
    pub const INVALID_CURRENCY: Self = Self::new("2007", "Invalid Currency");
    pub const INVALID_INTENT: Self = Self::new("2008", "Invalid Intent");
    pub const INSUFFICIENT_BALANCE: Self = Self::new("2023", "Insufficient Balance");
    pub const INVALID_REQUEST_BODY: Self = Self::new("2025", "Invalid request body");
    pub const INVALID_PAYMENT_STATE: Self = Self::new("2056", "Invalid Payment State");
    pub const ALREADY_COMPLETED: Self = Self::new("2062", "The payment has already been completed");
    pub const REFUND_EXCEEDS: Self =
        Self::new("2072", "Refund amount exceeds the transaction amount");
    pub const INVALID_USERNAME_OR_PASSWORD: Self =
        Self::new("4001", "Invalid username or password");
    pub const INVALID_TOKEN: Self = Self::new("9999", "Token is invalid or expired");

    const fn new(status_code: &'static str, status_message: &'static str) -> Self {
        Self {
            status_code,
            status_message,
        }
    }

    pub fn describe(self) -> Value {
        json!({
            "statusCode": self.status_code,
            "statusMessage": self.status_message,
        })
    }
}

/// bKash answers an accepted call with `0000`.
pub fn mark_successful(mut answer: Value) -> Value {
    answer["statusCode"] = Value::from("0000");
    answer["statusMessage"] = Value::from("Successful");
    answer
}
