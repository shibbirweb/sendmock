use sendmock_mail::find_route_pattern_error;

use super::route_wire::{InboundRouteAction, InboundRouteFilter};
use crate::OperationError;

const HIGHEST_PRIORITY: i64 = 32_767;
const LONGEST_DESCRIPTION_CHARACTERS: usize = 200;

fn field_error(field_name: &str, message: &str) -> OperationError {
    OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(field_name.to_owned()),
    }
}

/// An `http` or `https` URL, with `\g<name>` tokens allowed in it.
fn is_web_url(url_text: &str) -> bool {
    let lowercase_url = url_text.trim().to_lowercase();
    ["http://", "https://"].iter().any(|scheme| {
        lowercase_url
            .strip_prefix(scheme)
            .is_some_and(|rest| !rest.is_empty() && !rest.starts_with('/'))
    })
}

fn check_action(
    route_action: &InboundRouteAction,
    action_index: usize,
) -> Result<(), OperationError> {
    let action_field = format!("actions.{action_index}");
    match route_action {
        InboundRouteAction::ForwardUrl { url } if !is_web_url(url) => {
            Err(field_error(&action_field, "Enter an http or https URL"))
        }
        InboundRouteAction::ForwardEmail { address }
            if !address.split_once('@').is_some_and(|(local_part, domain)| {
                !local_part.is_empty()
                    && !domain.is_empty()
                    && !address.contains(char::is_whitespace)
            }) =>
        {
            Err(field_error(&action_field, "Enter an email address"))
        }
        InboundRouteAction::Store {
            notify_url: Some(notify_url),
        } if !notify_url.is_empty() && !is_web_url(notify_url) => Err(field_error(
            &action_field,
            "Enter an http or https URL, or leave it empty",
        )),
        _ => Ok(()),
    }
}

/// The editor's rules (WH-12.7): a priority from 0 to 32767, a short description, a valid
/// pattern and header, and at least one valid action.
pub fn check_inbound_route(
    priority: i64,
    description: &str,
    route_filter: &InboundRouteFilter,
    route_actions: &[InboundRouteAction],
) -> Result<(), OperationError> {
    if !(0..=HIGHEST_PRIORITY).contains(&priority) {
        return Err(field_error(
            "priority",
            "Use a whole number from 0 to 32767",
        ));
    }
    if description.chars().count() > LONGEST_DESCRIPTION_CHARACTERS {
        return Err(field_error("description", "Use 200 characters at most"));
    }
    match route_filter {
        InboundRouteFilter::MatchRecipient { pattern }
        | InboundRouteFilter::MatchHeader { pattern, .. } => {
            if let Some(pattern_error) = find_route_pattern_error(pattern) {
                return Err(field_error("pattern", pattern_error));
            }
        }
        InboundRouteFilter::CatchAll => {}
    }
    if let InboundRouteFilter::MatchHeader { header_name, .. } = route_filter
        && header_name.trim().is_empty()
    {
        return Err(field_error(
            "header_name",
            "Enter the header name, e.g. subject",
        ));
    }
    if route_actions.is_empty() {
        return Err(field_error("actions", "Add at least one action"));
    }
    for (action_index, route_action) in route_actions.iter().enumerate() {
        check_action(route_action, action_index)?;
    }
    Ok(())
}
