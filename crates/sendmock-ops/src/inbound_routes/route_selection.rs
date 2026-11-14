use sendmock_mail::{RoutableEmail, RouteFilterMatch, match_route_filter};
use sendmock_store::InboundRouteRecord;

use super::route_records::{read_route_actions, read_route_filter};
use super::route_wire::InboundRouteAction;
use crate::OperationError;

/// A route that takes the email, with what its filter captured and its actions in order.
pub struct SelectedRoute<'routes> {
    pub stored_route: &'routes InboundRouteRecord,
    pub route_match: RouteFilterMatch,
    pub route_actions: Vec<InboundRouteAction>,
}

impl SelectedRoute<'_> {
    pub fn calls_stop(&self) -> bool {
        self.route_actions.contains(&InboundRouteAction::Stop)
    }
}

/// The routes that take the email, in priority order, ending at the first that calls
/// `stop()`. Both a real incoming email and the match preview read this, so the preview
/// never disagrees with what runs (EM-22.2).
pub fn select_matching_routes<'routes>(
    stored_routes: &'routes [InboundRouteRecord],
    routable_email: &RoutableEmail,
) -> Result<Vec<SelectedRoute<'routes>>, OperationError> {
    let mut selected_routes = Vec::new();
    for stored_route in stored_routes {
        let filter_rule = read_route_filter(stored_route)?.to_filter_rule();
        let Some(route_match) = match_route_filter(&filter_rule, routable_email) else {
            continue;
        };
        let selected_route = SelectedRoute {
            stored_route,
            route_match,
            route_actions: read_route_actions(stored_route)?,
        };
        let should_stop = selected_route.calls_stop();
        selected_routes.push(selected_route);
        if should_stop {
            break;
        }
    }
    Ok(selected_routes)
}
