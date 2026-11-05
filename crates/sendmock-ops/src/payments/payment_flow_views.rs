use schemars::JsonSchema;
use sendmock_payments::{FlowStep, PaymentFlowDraft};
use serde::{Deserialize, Serialize};

/// One step of a flow with its own labels; `{method}`, `{amount}` and the other label
/// variables are filled in on the checkout page.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct PaymentFlowStep {
    /// The step type, e.g. `account_number`, `otp`, `pin` or `card_form`.
    #[serde(rename = "type")]
    pub step_type: String,
    /// Shown above the step; may be empty.
    pub title: String,
    /// The input's label; empty for steps without a field.
    pub field_label: String,
    /// Small text under the input.
    pub hint: String,
    /// The button's text.
    pub button_label: String,
}

impl PaymentFlowStep {
    pub fn to_flow_step(&self) -> FlowStep {
        FlowStep {
            step_type: self.step_type.clone(),
            title: self.title.clone(),
            field_label: self.field_label.clone(),
            hint: self.hint.clone(),
            button_label: self.button_label.clone(),
        }
    }
}

/// A flow as stored and shipped: its key, name, picker tab and steps in order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PaymentFlowRecord {
    pub key: String,
    pub name: String,
    pub picker_tab: String,
    pub steps: Vec<PaymentFlowStep>,
    pub is_builtin: bool,
}

impl PaymentFlowRecord {
    pub fn to_draft(&self) -> PaymentFlowDraft {
        PaymentFlowDraft {
            key: self.key.clone(),
            name: self.name.clone(),
            picker_tab: self.picker_tab.clone(),
            steps: self
                .steps
                .iter()
                .map(PaymentFlowStep::to_flow_step)
                .collect(),
        }
    }
}

/// How a customer pays, step by step.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct PaymentFlowDefinition {
    pub key: String,
    pub name: String,
    /// The checkout picker tab its methods show under, e.g. "Mobile banking".
    pub picker_tab: String,
    pub steps: Vec<PaymentFlowStep>,
    pub is_builtin: bool,
    /// A built-in that differs from its shipped default.
    pub is_modified: bool,
    /// Methods using it; a custom flow in use cannot be deleted.
    pub method_count: u32,
}

/// Body of `POST /api/v1/payments/flows`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentFlowInput {
    /// The flow's key; fixed after creation.
    pub key: String,
    pub name: String,
    pub picker_tab: String,
    pub steps: Vec<PaymentFlowStep>,
}

/// `PATCH /api/v1/payments/flows/{flowKey}`: the whole flow; its key stays as it was.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentFlowUpdate {
    /// The flow's key, from `GET /api/v1/payments/flows`.
    pub flow_key: String,
    #[serde(flatten)]
    pub changes: PaymentFlowInput,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentFlowReference {
    /// The flow's key, from `GET /api/v1/payments/flows`.
    pub flow_key: String,
}

/// A step to add; labels left out take the step type's defaults.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentFlowStepAddition {
    #[serde(rename = "type")]
    pub step_type: String,
    pub title: Option<String>,
    pub field_label: Option<String>,
    pub hint: Option<String>,
    pub button_label: Option<String>,
}

/// `POST /api/v1/payments/flows/{flowKey}/steps`: one step, appended unless a position is given.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentFlowStepAddRequest {
    /// The flow's key, from `GET /api/v1/payments/flows`.
    pub flow_key: String,
    /// The step to add.
    pub step: PaymentFlowStepAddition,
    /// Zero-based; the end of the flow when left out.
    pub position: Option<usize>,
}

/// `PATCH /api/v1/payments/flows/{flowKey}/steps/{stepIndex}`: new labels, a new position, or both.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentFlowStepUpdateRequest {
    /// The flow's key, from `GET /api/v1/payments/flows`.
    pub flow_key: String,
    /// The step's zero-based position in the flow.
    pub step_index: usize,
    /// Moves the step to this zero-based position.
    pub position: Option<usize>,
    pub title: Option<String>,
    pub field_label: Option<String>,
    pub hint: Option<String>,
    pub button_label: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentFlowStepReference {
    /// The flow's key, from `GET /api/v1/payments/flows`.
    pub flow_key: String,
    /// The step's zero-based position in the flow.
    pub step_index: usize,
}

/// Labels of a step type, the defaults a new step of it gets.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct PaymentStepLabels {
    pub title: String,
    pub field_label: String,
    pub hint: String,
    pub button_label: String,
}

/// One entry of the step catalogue.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct PaymentStepTypeInfo {
    #[serde(rename = "type")]
    pub step_type: String,
    pub name: String,
    pub description: String,
    /// Decides the outcome from the method's test values; a flow has at most one.
    pub is_deciding: bool,
    /// Shows an input, so it needs a field label.
    pub has_field: bool,
    pub method_values: Vec<String>,
    pub default_labels: PaymentStepLabels,
}

/// A variable step labels can use.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct PaymentFlowVariable {
    /// As written in a label, e.g. `{method}`.
    pub token: String,
    /// What it becomes on the checkout page.
    pub description: String,
    pub example: String,
}
