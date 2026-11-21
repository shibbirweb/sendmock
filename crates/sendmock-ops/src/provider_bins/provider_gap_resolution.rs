//! Which attached bin a provider request no built-in operation answers goes to.

use sendmock_store::ProviderBinRecord;

use crate::providers::{
    EMAIL_PROVIDER_AREA, MessageProviderDefinition, ProviderHttpRequest, SMS_PROVIDER_AREA,
    load_area_providers,
};
use crate::{OperationContext, OperationError};

/// How many leading segments of the request path fit the template, a `{name}` segment fitting
/// any value; `/2010-04-01/Accounts/AC1/Calls.json` shares three with Twilio's Messages path.
fn count_shared_segments(path_template: &str, request_path: &str) -> usize {
    path_template
        .split('/')
        .zip(request_path.split('/'))
        .skip(1)
        .take_while(|(template_segment, path_segment)| {
            template_segment == path_segment
                || (template_segment.starts_with('{') && !path_segment.is_empty())
        })
        .count()
}

/// How closely a message provider's own paths fit the request; 0 for push services, payment
/// gateways and providers without operations.
fn score_provider_paths(
    message_providers: &[MessageProviderDefinition],
    provider_bin: &ProviderBinRecord,
    request_path: &str,
) -> usize {
    message_providers
        .iter()
        .filter(|provider| {
            provider.key == provider_bin.provider_key && provider.area == provider_bin.area
        })
        .flat_map(|provider| &provider.operations)
        .map(|operation| count_shared_segments(&operation.path, request_path))
        .max()
        .unwrap_or_default()
}

/// On the shared provider port: the attached provider whose `Host` the request names, else
/// the one whose paths fit it best, else the only one attached.
fn choose_on_shared_port(
    message_providers: &[MessageProviderDefinition],
    attached_bins: Vec<ProviderBinRecord>,
    request: &ProviderHttpRequest,
) -> Option<ProviderBinRecord> {
    let host_match = request.host().and_then(|request_host| {
        attached_bins.iter().find(|provider_bin| {
            message_providers.iter().any(|provider| {
                provider.key == provider_bin.provider_key
                    && provider.host.as_deref().is_some_and(|provider_host| {
                        provider_host.eq_ignore_ascii_case(request_host)
                    })
            })
        })
    });
    if let Some(host_match) = host_match {
        return Some(host_match.clone());
    }
    let mut scored_bins: Vec<(usize, &ProviderBinRecord)> = attached_bins
        .iter()
        .map(|provider_bin| {
            (
                score_provider_paths(message_providers, provider_bin, &request.path),
                provider_bin,
            )
        })
        .collect();
    scored_bins.sort_by_key(|(path_score, _)| std::cmp::Reverse(*path_score));
    match scored_bins.as_slice() {
        [(best_score, best_bin), rest @ ..]
            if *best_score > 0 && rest.first().is_none_or(|next| next.0 < *best_score) =>
        {
            Some((*best_bin).clone())
        }
        [(_, only_bin)] => Some((*only_bin).clone()),
        _ => None,
    }
}

/// The attached bin for a request: the named provider's (`/providers/<key>/`, its own port, or
/// the provider whose API it is), or on the shared provider port the one the request fits.
pub async fn find_gap_bin(
    operation_context: &OperationContext,
    named_provider_key: Option<&str>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderBinRecord>, OperationError> {
    let attached_bins = operation_context
        .http_catcher_stores
        .provider_bins
        .list_provider_bins()
        .await?;
    if attached_bins.is_empty() {
        return Ok(None);
    }
    if let Some(provider_key) = named_provider_key {
        return Ok(attached_bins
            .into_iter()
            .find(|provider_bin| provider_bin.provider_key == provider_key));
    }
    let mut message_providers = load_area_providers(operation_context, SMS_PROVIDER_AREA).await?;
    message_providers.extend(load_area_providers(operation_context, EMAIL_PROVIDER_AREA).await?);
    Ok(choose_on_shared_port(
        &message_providers,
        attached_bins,
        request,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::ProviderOperation;

    fn attached(area: &str, provider_key: &str) -> ProviderBinRecord {
        ProviderBinRecord {
            area: area.to_owned(),
            provider_key: provider_key.to_owned(),
            bin_id: format!("bin-{provider_key}"),
            bin_name: format!("{provider_key}-gaps"),
            created_at_unix_ms: 1,
        }
    }

    fn provider(area: &str, key: &str, host: &str, path: &str) -> MessageProviderDefinition {
        MessageProviderDefinition {
            key: key.to_owned(),
            area: area.to_owned(),
            host: Some(host.to_owned()),
            operations: vec![ProviderOperation {
                kind: "send".to_owned(),
                method: "POST".to_owned(),
                path: path.to_owned(),
                request_format: "form".to_owned(),
            }],
            ..MessageProviderDefinition::default()
        }
    }

    fn request(path: &str, host: Option<&str>) -> ProviderHttpRequest {
        ProviderHttpRequest {
            method: "POST".to_owned(),
            path: path.to_owned(),
            headers: host
                .map(|host| [("host".to_owned(), host.to_owned())].into())
                .unwrap_or_default(),
            ..ProviderHttpRequest::default()
        }
    }

    // AC: PL-21.2
    #[test]
    fn the_shared_port_picks_the_provider_by_host_then_by_its_paths() {
        let providers = vec![
            provider(
                "sms",
                "twilio",
                "api.twilio.com",
                "/2010-04-01/Accounts/{AccountSid}/Messages.json",
            ),
            provider("sms", "vonage", "rest.nexmo.com", "/sms/json"),
        ];
        let both_attached = || vec![attached("sms", "twilio"), attached("sms", "vonage")];

        let by_path = choose_on_shared_port(
            &providers,
            both_attached(),
            &request("/2010-04-01/Accounts/AC1/Calls.json", None),
        );
        let by_host = choose_on_shared_port(
            &providers,
            both_attached(),
            &request("/v1/anything", Some("rest.nexmo.com:8026")),
        );
        let undecided =
            choose_on_shared_port(&providers, both_attached(), &request("/v9/unknown", None));

        assert_eq!(
            by_path.map(|bin| bin.provider_key),
            Some("twilio".to_owned())
        );
        assert_eq!(
            by_host.map(|bin| bin.provider_key),
            Some("vonage".to_owned())
        );
        assert_eq!(undecided, None);
    }

    // AC: PL-21.3
    #[test]
    fn the_only_attached_provider_takes_any_unmatched_path() {
        let custom_vendor = attached("sms", "acme_voice");

        let chosen = choose_on_shared_port(&[], vec![custom_vendor], &request("/v2/calls", None));

        assert_eq!(
            chosen.map(|bin| bin.provider_key),
            Some("acme_voice".to_owned())
        );
    }
}
