use serde::{Deserialize, Serialize};

use crate::inbound_routes::{
    InboundRouteAction, InboundRouteFilter, build_route_record, check_inbound_route,
    read_route_actions, read_route_filter,
};
use crate::seed::seed_section_adapter::{
    SeedItem, impl_seed_section_adapter, read_seed_table, write_seed_table,
};
use crate::seed::seed_sections::INBOUND_ROUTES_SECTION;
use crate::{OperationContext, OperationError};

/// `[[email.inbound_routes]]`, matched by `description`, with the filter and actions in the
/// shape `POST /inbound-routes` takes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedInboundRoute {
    description: String,
    priority: i64,
    filter: InboundRouteFilter,
    actions: Vec<InboundRouteAction>,
}

pub struct InboundRouteSeedAdapter;

impl InboundRouteSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_route: SeedInboundRoute = read_seed_table(item_table)?;
        check_inbound_route(
            seed_route.priority,
            &seed_route.description,
            &seed_route.filter,
            &seed_route.actions,
        )?;
        let route_description = seed_route.description.trim().to_owned();
        let inbound_routes = &operation_context.email_stores.inbound_routes;
        let existing_route = inbound_routes
            .list_routes()
            .await?
            .into_iter()
            .find(|stored_route| stored_route.description == route_description);
        let (route_id, created_at_unix_ms) = match existing_route {
            Some(existing_route) => (existing_route.route_id, existing_route.created_at_unix_ms),
            None => (
                operation_context.id_generator.generate_id().to_string(),
                operation_context.clock.now_unix_ms(),
            ),
        };
        let route_record = build_route_record(
            route_id,
            seed_route.priority,
            &route_description,
            &seed_route.filter,
            &seed_route.actions,
            created_at_unix_ms,
        )?;
        inbound_routes.save_route(route_record).await?;
        Ok(route_description)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let stored_routes = operation_context
            .email_stores
            .inbound_routes
            .list_routes()
            .await?;
        stored_routes
            .into_iter()
            .map(|stored_route| {
                Ok(SeedItem {
                    item_key: stored_route.description.clone(),
                    item_name: stored_route.description.clone(),
                    table: write_seed_table(&SeedInboundRoute {
                        filter: read_route_filter(&stored_route)?,
                        actions: read_route_actions(&stored_route)?,
                        description: stored_route.description,
                        priority: stored_route.priority,
                    })?,
                })
            })
            .collect()
    }

    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let inbound_routes = &operation_context.email_stores.inbound_routes;
        for stored_route in inbound_routes.list_routes().await? {
            if !kept_item_keys.contains(&stored_route.description) {
                inbound_routes.delete_route(&stored_route.route_id).await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(InboundRouteSeedAdapter, INBOUND_ROUTES_SECTION);
