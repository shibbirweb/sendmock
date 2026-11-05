use sendmock_payments::{add_flow_step, move_flow_step, remove_flow_step};

use super::payment_flow_catalogue::{
    find_payment_flow, payment_flow_variables, payment_step_types, present_payment_flow,
    save_payment_flow,
};
use super::payment_flow_operations::check_flow_record;
use super::payment_flow_views::{
    PaymentFlowDefinition, PaymentFlowRecord, PaymentFlowStep, PaymentFlowStepAddRequest,
    PaymentFlowStepAddition, PaymentFlowStepReference, PaymentFlowStepUpdateRequest,
    PaymentFlowVariable, PaymentStepTypeInfo,
};
use crate::{
    HttpMethod, NoInput, Operation, OperationContext, OperationDefinition, OperationError,
};

fn step_definition(
    operation_id: &'static str,
    method: HttpMethod,
    path: &'static str,
    summary: &'static str,
    cli_usage: &'static str,
    mcp_tool: &'static str,
) -> OperationDefinition {
    OperationDefinition {
        operation_id,
        method,
        path,
        summary,
        is_read_only: method == HttpMethod::Get,
        cli_usage,
        mcp_tool,
        ..OperationDefinition::DEFAULTS
    }
}

fn step_not_found(step_index: usize) -> OperationError {
    OperationError::NotFound {
        message: format!("The flow has no step {step_index}"),
    }
}

/// Checks the flow with its changed steps as a whole, then stores it, as one step change
/// must leave a flow that follows every rule.
async fn save_changed_steps(
    operation_context: &OperationContext,
    stored_flow: PaymentFlowRecord,
    changed_steps: Vec<PaymentFlowStep>,
) -> Result<PaymentFlowDefinition, OperationError> {
    let changed_flow = PaymentFlowRecord {
        steps: changed_steps,
        ..stored_flow
    };
    check_flow_record(operation_context, &changed_flow, false).await?;
    save_payment_flow(operation_context, &changed_flow).await?;
    present_payment_flow(operation_context, changed_flow).await
}

/// The added step with the step type's labels for any it leaves out.
fn complete_step(step_addition: PaymentFlowStepAddition) -> PaymentFlowStep {
    let default_labels = payment_step_types()
        .into_iter()
        .find(|step_type_info| step_type_info.step_type == step_addition.step_type)
        .map(|step_type_info| step_type_info.default_labels);
    let default_label =
        |read_label: fn(&super::payment_flow_views::PaymentStepLabels) -> &String| {
            default_labels
                .as_ref()
                .map(read_label)
                .cloned()
                .unwrap_or_default()
        };
    PaymentFlowStep {
        title: step_addition
            .title
            .unwrap_or_else(|| default_label(|labels| &labels.title)),
        field_label: step_addition
            .field_label
            .unwrap_or_else(|| default_label(|labels| &labels.field_label)),
        hint: step_addition
            .hint
            .unwrap_or_else(|| default_label(|labels| &labels.hint)),
        button_label: step_addition
            .button_label
            .unwrap_or_else(|| default_label(|labels| &labels.button_label)),
        step_type: step_addition.step_type,
    }
}

pub struct AddPaymentFlowStepOperation;

impl Operation for AddPaymentFlowStepOperation {
    type Input = PaymentFlowStepAddRequest;
    type Output = PaymentFlowDefinition;

    fn definition(&self) -> OperationDefinition {
        step_definition(
            "postPaymentsFlowsByFlowKeySteps",
            HttpMethod::Post,
            "/api/v1/payments/flows/{flowKey}/steps",
            "Add a step to a flow.",
            "sendmock payments flows steps add <flowKey>",
            "sendmock_payment_flow_step_add",
        )
    }

    /// Labels left out take the step type's, so `{ "type": "otp" }` is enough.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentFlowStepAddRequest,
    ) -> Result<PaymentFlowDefinition, OperationError> {
        let stored_flow = find_payment_flow(operation_context, &input.flow_key).await?;
        let mut changed_steps = stored_flow.steps.clone();
        add_flow_step(
            &mut changed_steps,
            complete_step(input.step),
            input.position,
        );
        save_changed_steps(operation_context, stored_flow, changed_steps).await
    }
}

pub struct UpdatePaymentFlowStepOperation;

impl Operation for UpdatePaymentFlowStepOperation {
    type Input = PaymentFlowStepUpdateRequest;
    type Output = PaymentFlowDefinition;

    fn definition(&self) -> OperationDefinition {
        step_definition(
            "patchPaymentsFlowsByFlowKeyStepsByStepIndex",
            HttpMethod::Patch,
            "/api/v1/payments/flows/{flowKey}/steps/{stepIndex}",
            "Change one step of a flow.",
            "sendmock payments flows steps update <flowKey> <stepIndex>",
            "sendmock_payment_flow_step_update",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentFlowStepUpdateRequest,
    ) -> Result<PaymentFlowDefinition, OperationError> {
        let stored_flow = find_payment_flow(operation_context, &input.flow_key).await?;
        let mut changed_steps = stored_flow.steps.clone();
        let Some(changed_step) = changed_steps.get_mut(input.step_index) else {
            return Err(step_not_found(input.step_index));
        };
        let new_labels = [
            (&mut changed_step.title, input.title),
            (&mut changed_step.field_label, input.field_label),
            (&mut changed_step.hint, input.hint),
            (&mut changed_step.button_label, input.button_label),
        ];
        for (stored_label, new_label) in new_labels {
            if let Some(new_label) = new_label {
                *stored_label = new_label;
            }
        }
        if let Some(position) = input.position {
            move_flow_step(&mut changed_steps, input.step_index, position);
        }
        save_changed_steps(operation_context, stored_flow, changed_steps).await
    }
}

pub struct RemovePaymentFlowStepOperation;

impl Operation for RemovePaymentFlowStepOperation {
    type Input = PaymentFlowStepReference;
    type Output = PaymentFlowDefinition;

    fn definition(&self) -> OperationDefinition {
        step_definition(
            "deletePaymentsFlowsByFlowKeyStepsByStepIndex",
            HttpMethod::Delete,
            "/api/v1/payments/flows/{flowKey}/steps/{stepIndex}",
            "Remove one step of a flow.",
            "sendmock payments flows steps remove <flowKey> <stepIndex>",
            "sendmock_payment_flow_step_remove",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentFlowStepReference,
    ) -> Result<PaymentFlowDefinition, OperationError> {
        let stored_flow = find_payment_flow(operation_context, &input.flow_key).await?;
        let mut changed_steps = stored_flow.steps.clone();
        if !remove_flow_step(&mut changed_steps, input.step_index) {
            return Err(step_not_found(input.step_index));
        }
        save_changed_steps(operation_context, stored_flow, changed_steps).await
    }
}

pub struct ListPaymentStepTypesOperation;

impl Operation for ListPaymentStepTypesOperation {
    type Input = NoInput;
    type Output = Vec<PaymentStepTypeInfo>;

    fn definition(&self) -> OperationDefinition {
        step_definition(
            "getPaymentsStepTypes",
            HttpMethod::Get,
            "/api/v1/payments/step-types",
            "The step types a flow can use, with their fields.",
            "sendmock payments flows step-types",
            "sendmock_payment_step_type_list",
        )
    }

    async fn execute(
        &self,
        _operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<PaymentStepTypeInfo>, OperationError> {
        Ok(payment_step_types())
    }
}

pub struct ListPaymentFlowVariablesOperation;

impl Operation for ListPaymentFlowVariablesOperation {
    type Input = NoInput;
    type Output = Vec<PaymentFlowVariable>;

    fn definition(&self) -> OperationDefinition {
        step_definition(
            "getPaymentsFlowVariables",
            HttpMethod::Get,
            "/api/v1/payments/flow-variables",
            "The variables a step label can use.",
            "sendmock payments flows variables",
            "sendmock_payment_flow_variable_list",
        )
    }

    async fn execute(
        &self,
        _operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<PaymentFlowVariable>, OperationError> {
        Ok(payment_flow_variables())
    }
}
