use std::collections::BTreeMap;

use super::message_provider_definition::{MessageProviderDefinition, ProviderOperation};
use super::provider_http::ProviderHttpRequest;

/// The provider and operation a request is for, with the values of the path's `{name}` parts.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MatchedOperation<'definitions> {
    pub provider: &'definitions MessageProviderDefinition,
    pub operation: &'definitions ProviderOperation,
    pub path_params: BTreeMap<String, String>,
}

/// Which providers a request may reach: the one its `/providers/<key>/` prefix names, or on
/// the provider port every provider, told apart by `Host` when two share a path.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderRoute<'key> {
    Prefixed(&'key str),
    ProviderPort,
}

pub fn match_operation<'definitions>(
    providers: &'definitions [MessageProviderDefinition],
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Option<MatchedOperation<'definitions>> {
    let candidates = providers.iter().filter(|provider| {
        provider.is_routable()
            && match provider_route {
                ProviderRoute::Prefixed(provider_key) => provider.key == provider_key,
                ProviderRoute::ProviderPort => true,
            }
    });
    let mut matches: Vec<MatchedOperation<'definitions>> = candidates
        .flat_map(|provider| {
            provider.operations.iter().filter_map(move |operation| {
                if !operation.method.eq_ignore_ascii_case(&request.method) {
                    return None;
                }
                match_path_template(&operation.path, &request.path).map(|path_params| {
                    MatchedOperation {
                        provider,
                        operation,
                        path_params,
                    }
                })
            })
        })
        .collect();
    if matches.len() > 1
        && let Some(request_host) = request.host()
        && let Some(host_index) = matches.iter().position(|matched| {
            matched
                .provider
                .host
                .as_deref()
                .is_some_and(|provider_host| provider_host.eq_ignore_ascii_case(request_host))
        })
    {
        return Some(matches.swap_remove(host_index));
    }
    matches.into_iter().next()
}

/// The values of `{name}` parts when `path` fits the template, segment by segment.
pub fn match_path_template(path_template: &str, path: &str) -> Option<BTreeMap<String, String>> {
    let path = path.split('?').next().unwrap_or(path);
    let template_segments: Vec<&str> = path_template.split('/').collect();
    let path_segments: Vec<&str> = path.split('/').collect();
    if template_segments.len() != path_segments.len() {
        return None;
    }
    let mut path_params = BTreeMap::new();
    for (template_segment, path_segment) in template_segments.iter().zip(&path_segments) {
        path_params.extend(read_segment_params(template_segment, path_segment)?);
    }
    Some(path_params)
}

/// A segment such as `{MessageSid}.json` matched against `SM123.json`.
fn read_segment_params(
    template_segment: &str,
    path_segment: &str,
) -> Option<Vec<(String, String)>> {
    let Some((literal_prefix, rest)) = template_segment.split_once('{') else {
        return (template_segment == path_segment).then(Vec::new);
    };
    let (param_name, literal_suffix) = rest.split_once('}')?;
    let param_value = path_segment
        .strip_prefix(literal_prefix)?
        .strip_suffix(literal_suffix)?;
    (!param_value.is_empty()).then(|| vec![(param_name.to_owned(), param_value.to_owned())])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn path_templates_read_their_variable_parts() {
        let path_params = match_path_template(
            "/2010-04-01/Accounts/{AccountSid}/Messages/{MessageSid}.json",
            "/2010-04-01/Accounts/AC123/Messages/SM456.json",
        );

        assert_eq!(
            path_params,
            Some(BTreeMap::from([
                ("AccountSid".to_owned(), "AC123".to_owned()),
                ("MessageSid".to_owned(), "SM456".to_owned()),
            ]))
        );
        assert_eq!(
            match_path_template(
                "/2010-04-01/Accounts/{AccountSid}/Messages.json",
                "/2010-04-01/Accounts/AC123/Messages/SM456.json"
            ),
            None
        );
        assert_eq!(
            match_path_template("/sms/json", "/sms/json?x=1"),
            Some(BTreeMap::new())
        );
        assert_eq!(match_path_template("/v1/{id}.json", "/v1/.json"), None);
    }
}
