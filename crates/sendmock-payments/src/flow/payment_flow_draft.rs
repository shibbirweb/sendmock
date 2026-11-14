use super::PaymentStepType;

/// One step of a flow with its own labels; the type is kept as written so an unknown one can
/// be reported.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FlowStep {
    pub step_type: String,
    pub title: String,
    pub field_label: String,
    pub hint: String,
    pub button_label: String,
}

impl FlowStep {
    pub fn known_type(&self) -> Option<PaymentStepType> {
        PaymentStepType::parse(&self.step_type)
    }

    pub fn labels(&self) -> [&str; 4] {
        [
            &self.title,
            &self.field_label,
            &self.hint,
            &self.button_label,
        ]
    }
}

/// A flow as it is about to be saved.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentFlowDraft {
    pub key: String,
    pub name: String,
    pub picker_tab: String,
    pub steps: Vec<FlowStep>,
}
