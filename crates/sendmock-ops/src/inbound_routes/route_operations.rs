use super::route_records::{build_route_record, find_route_or_not_found, present_inbound_route};
use super::route_validation::check_inbound_route;
use super::route_wire::{
    InboundRoute, InboundRouteInput, InboundRouteReference, InboundRouteUpdate,
};
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

pub struct ListInboundRoutesOperation;

impl Operation for ListInboundRoutesOperation {
    type Input = NoInput;
    type Output = Vec<InboundRoute>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getInboundRoutes",
            method: HttpMethod::Get,
            path: "/api/v1/inbound-routes",
            summary: "Routes for incoming email, in priority order.",
            is_read_only: true,
            cli_usage: "sendmock route list",
            mcp_tool: "sendmock_inbound_route_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<InboundRoute>, OperationError> {
        operation_context
            .email_stores
            .inbound_routes
            .list_routes()
            .await?
            .iter()
            .map(present_inbound_route)
            .collect()
    }
}

pub struct CreateInboundRouteOperation;

impl Operation for CreateInboundRouteOperation {
    type Input = InboundRouteInput;
    type Output = InboundRoute;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postInboundRoutes",
            method: HttpMethod::Post,
            path: "/api/v1/inbound-routes",
            summary: "Add a route.",
            cli_usage: "sendmock route create",
            mcp_tool: "sendmock_inbound_route_create",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: InboundRouteInput,
    ) -> Result<InboundRoute, OperationError> {
        check_inbound_route(
            input.priority,
            &input.description,
            &input.filter,
            &input.actions,
        )?;
        let route_record = build_route_record(
            operation_context.id_generator.generate_id().to_string(),
            input.priority,
            &input.description,
            &input.filter,
            &input.actions,
            operation_context.clock.now_unix_ms(),
        )?;
        operation_context
            .email_stores
            .inbound_routes
            .save_route(route_record.clone())
            .await?;
        present_inbound_route(&route_record)
    }
}

pub struct UpdateInboundRouteOperation;

impl Operation for UpdateInboundRouteOperation {
    type Input = InboundRouteUpdate;
    type Output = InboundRoute;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchInboundRoutesByRouteId",
            method: HttpMethod::Patch,
            path: "/api/v1/inbound-routes/{routeId}",
            summary: "Change a route.",
            cli_usage: "sendmock route update <routeId>",
            mcp_tool: "sendmock_inbound_route_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: InboundRouteUpdate,
    ) -> Result<InboundRoute, OperationError> {
        let stored_route = find_route_or_not_found(operation_context, &input.route_id).await?;
        check_inbound_route(
            input.priority,
            &input.description,
            &input.filter,
            &input.actions,
        )?;
        let route_record = build_route_record(
            stored_route.route_id,
            input.priority,
            &input.description,
            &input.filter,
            &input.actions,
            stored_route.created_at_unix_ms,
        )?;
        operation_context
            .email_stores
            .inbound_routes
            .save_route(route_record.clone())
            .await?;
        present_inbound_route(&route_record)
    }
}

pub struct DeleteInboundRouteOperation;

impl Operation for DeleteInboundRouteOperation {
    type Input = InboundRouteReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteInboundRoutesByRouteId",
            method: HttpMethod::Delete,
            path: "/api/v1/inbound-routes/{routeId}",
            summary: "Delete a route.",
            is_destructive: true,
            cli_usage: "sendmock route delete <routeId>",
            mcp_tool: "sendmock_inbound_route_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: InboundRouteReference,
    ) -> Result<NoContent, OperationError> {
        if !operation_context
            .email_stores
            .inbound_routes
            .delete_route(&input.route_id)
            .await?
        {
            find_route_or_not_found(operation_context, &input.route_id).await?;
        }
        Ok(NoContent)
    }
}
