use super::health_status::{HealthState, HealthStatus};
use crate::{
    HttpMethod, NoInput, Operation, OperationContext, OperationDefinition, OperationError,
};

pub struct GetHealthOperation;

impl Operation for GetHealthOperation {
    type Input = NoInput;
    type Output = HealthStatus;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getHealth",
            method: HttpMethod::Get,
            path: "/api/v1/health",
            summary: "Liveness check; answers while the server runs.",
            is_read_only: true,
        }
    }

    async fn execute(
        &self,
        _operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<HealthStatus, OperationError> {
        Ok(HealthStatus {
            status: HealthState::Ok,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_a_read_only_get_at_the_contract_path() {
        let definition = GetHealthOperation.definition();

        assert_eq!(definition.method, HttpMethod::Get);
        assert_eq!(definition.path, "/api/v1/health");
        assert!(definition.is_read_only);
    }

    #[test]
    fn its_answer_serialises_as_status_ok() -> Result<(), serde_json::Error> {
        let health_status = HealthStatus {
            status: HealthState::Ok,
        };

        assert_eq!(
            serde_json::to_value(health_status)?,
            serde_json::json!({ "status": "ok" })
        );
        Ok(())
    }
}
