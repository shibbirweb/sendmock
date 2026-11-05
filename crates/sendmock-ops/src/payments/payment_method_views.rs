use schemars::JsonSchema;
use sendmock_payments::{PaymentMethodDraft, TestNumberDraft};
use serde::{Deserialize, Serialize};

/// What a test card does on a checkout page.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum CardTestOutcome {
    Succeed,
    Decline,
    ThreeDs,
    SucceedThenDispute,
}

/// What a test number or voucher code does on a checkout page.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum NumberTestOutcome {
    Succeed,
    Decline,
    WrongPin,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum DeclineReason {
    InsufficientFunds,
    ExpiredCard,
    IncorrectCvc,
    GenericDecline,
    Fraudulent,
    AuthenticationFailed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum DefaultOutcome {
    Succeed,
    Decline,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct TestCardValue {
    pub number: String,
    pub outcome: CardTestOutcome,
    #[schemars(required, schema_with = "crate::nullable_schema::<DeclineReason>")]
    pub decline_reason: Option<DeclineReason>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct TestNumberValue {
    pub number: String,
    pub outcome: NumberTestOutcome,
    #[schemars(required, schema_with = "crate::nullable_schema::<DeclineReason>")]
    pub decline_reason: Option<DeclineReason>,
}

/// The fields a method is made of, as stored, shipped and sent in a create or change.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct PaymentMethodFields {
    pub key: String,
    pub name: String,
    /// The flow its checkout runs, e.g. `wallet`.
    pub flow: String,
    /// A colour like `#e2136e`.
    pub accent: String,
    pub is_enabled: bool,
    pub test_cards: Vec<TestCardValue>,
    pub test_numbers: Vec<TestNumberValue>,
    pub otp: String,
    pub pin: String,
    pub default_outcome: DefaultOutcome,
    pub test_account: String,
}

impl PaymentMethodFields {
    pub fn to_draft(&self) -> PaymentMethodDraft {
        PaymentMethodDraft {
            key: self.key.clone(),
            name: self.name.clone(),
            accent: self.accent.clone(),
            test_card_numbers: self
                .test_cards
                .iter()
                .map(|test_card| test_card.number.clone())
                .collect(),
            test_numbers: self
                .test_numbers
                .iter()
                .map(|test_number| TestNumberDraft {
                    number: test_number.number.clone(),
                    outcome: serde_json::to_value(test_number.outcome)
                        .ok()
                        .and_then(|outcome| outcome.as_str().map(str::to_owned))
                        .unwrap_or_default(),
                })
                .collect(),
            otp: self.otp.clone(),
            pin: self.pin.clone(),
            test_account: self.test_account.clone(),
        }
    }
}

/// A method as stored and shipped.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PaymentMethodRecord {
    #[serde(flatten)]
    pub fields: PaymentMethodFields,
    pub is_builtin: bool,
}

impl super::payment_definition_store::PaymentDefinition for PaymentMethodRecord {
    fn definition_key(&self) -> &str {
        &self.fields.key
    }

    fn is_builtin(&self) -> bool {
        self.is_builtin
    }
}

/// What a customer pays with on a checkout page, and the test values its flow asks for.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct PaymentMethodDefinition {
    #[serde(flatten)]
    pub fields: PaymentMethodFields,
    pub is_builtin: bool,
    /// A built-in that differs from its shipped default.
    pub is_modified: bool,
    /// The gateways offering it.
    pub gateway_keys: Vec<String>,
    /// Payments made with it; a custom method with payments cannot be deleted.
    pub payment_count: u32,
}

/// `PATCH /api/v1/payments/methods/{methodKey}`: the whole method; its key and flow stay.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentMethodUpdate {
    /// The method's key, from `GET /api/v1/payments/methods`.
    pub method_key: String,
    #[serde(flatten)]
    pub changes: PaymentMethodFields,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentMethodReference {
    /// The method's key, from `GET /api/v1/payments/methods`.
    pub method_key: String,
}
