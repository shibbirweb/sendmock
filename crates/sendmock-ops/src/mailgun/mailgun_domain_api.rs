use super::mailgun_complaint_recording::MAILGUN_PROVIDER_KEY;
use super::mailgun_complaints_api::answer_complaints;
use super::mailgun_events_api::{EventsQuery, answer_events};
use crate::providers::{ProviderHttpRequest, ProviderOutcome, ProviderRoute};
use crate::{OperationContext, OperationError};

/// What a request under `/v3/{domain}/` asks for.
enum DomainTarget<'path> {
    Events { page_token: Option<&'path str> },
    Complaints { address: Option<&'path str> },
}

fn read_domain_target(request_path: &str) -> Option<(&str, DomainTarget<'_>)> {
    let after_version = request_path.strip_prefix("/v3/")?;
    let (domain, rest_of_path) = after_version.split_once('/')?;
    if domain == "domains" || domain == "routes" {
        return None;
    }
    let (resource, item) = match rest_of_path.split_once('/') {
        Some((resource, item)) => (
            resource,
            Some(item).filter(|item| !item.is_empty() && !item.contains('/'))?,
        ),
        None => (rest_of_path, ""),
    };
    let item = (!item.is_empty()).then_some(item);
    match resource {
        "events" => Some((domain, DomainTarget::Events { page_token: item })),
        "complaints" => Some((domain, DomainTarget::Complaints { address: item })),
        _ => None,
    }
}

/// The URL Mailgun's paging links start with: where the request came in.
fn read_base_url(provider_route: ProviderRoute<'_>, request: &ProviderHttpRequest) -> String {
    let host = request.header("host").unwrap_or("127.0.0.1");
    match provider_route {
        ProviderRoute::Prefixed(provider_key) => format!("http://{host}/providers/{provider_key}"),
        _ => format!("http://{host}"),
    }
}

/// Mailgun's events and complaints APIs for a sending domain, served with the Mailgun provider
/// (EM-23). `None` for other paths, such as the send.
pub async fn answer_mailgun_domain_request(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    let is_mailgun_route = matches!(
        provider_route,
        ProviderRoute::Prefixed(MAILGUN_PROVIDER_KEY) | ProviderRoute::ProviderPort
    );
    let Some((domain, target)) = read_domain_target(&request.path).filter(|_| is_mailgun_route)
    else {
        return Ok(None);
    };
    let base_url = read_base_url(provider_route, request);
    let response = match target {
        DomainTarget::Events { page_token } if request.method == "GET" => {
            let query = match page_token {
                Some(page_token) => EventsQuery::from_page_token(page_token).unwrap_or_default(),
                None => EventsQuery::from_request(request),
            };
            Some(answer_events(operation_context, domain, &query, &base_url).await?)
        }
        DomainTarget::Events { .. } => None,
        DomainTarget::Complaints { address } => {
            answer_complaints(operation_context, domain, address, request, &base_url).await?
        }
    };
    Ok(response.map(|response| ProviderOutcome {
        response,
        provider_key: Some(MAILGUN_PROVIDER_KEY.to_owned()),
        created_message: None,
        secret_values: Vec::new(),
        is_unknown_path: false,
    }))
}
