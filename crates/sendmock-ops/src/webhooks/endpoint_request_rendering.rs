//! The request an endpoint sends for one event: URL and query params, headers and body, each
//! rendered against the delivery's context (WH-07.14). A queued delivery and the preview both
//! use this, so the preview shows what is sent (WH-07.8).

use std::collections::BTreeMap;

use sendmock_core::{TemplateEscape, TemplateRenderMode};

use super::endpoint_body_rendering::render_endpoint_body;
use super::endpoint_settings::{EndpointRequestSettings, RenderMode};
use super::endpoint_template::EndpointTemplate;
use super::request_part_renderer::{RenderProblem, RequestPartRenderer};
use crate::numbers::is_http_url;
use crate::{AppEvent, OperationError, RecordedHttpRequest};

pub fn to_template_render_mode(render_mode: RenderMode) -> TemplateRenderMode {
    match render_mode {
        RenderMode::Strict => TemplateRenderMode::Strict,
        RenderMode::Lenient => TemplateRenderMode::Lenient,
    }
}

/// The URL with its query params appended, each value URL-encoded.
fn render_url(
    part_renderer: &mut RequestPartRenderer,
    url_template: &str,
    request_settings: &EndpointRequestSettings,
) -> Result<String, OperationError> {
    let rendered_url = part_renderer
        .render_part(url_template, "url", TemplateEscape::None)
        .trim()
        .to_owned();
    if !part_renderer.has_errors() && !is_http_url(&rendered_url) {
        part_renderer.problems.push(RenderProblem::error(
            format!("The URL renders \"{rendered_url}\", which is not an http:// or https:// URL"),
            "url",
        ));
    }
    let query_pairs: Vec<(String, String)> = request_settings
        .query_params
        .iter()
        .enumerate()
        .map(|(query_index, query_param)| {
            let source = format!("query.{query_index}");
            let rendered_value =
                part_renderer.render_part(&query_param.value, &source, TemplateEscape::None);
            (query_param.name.clone(), rendered_value)
        })
        .collect();
    if query_pairs.is_empty() {
        return Ok(rendered_url);
    }
    let encoded_query = serde_urlencoded::to_string(query_pairs)
        .map_err(|encode_error| OperationError::Internal(encode_error.to_string()))?;
    let separator = if rendered_url.contains('?') { '&' } else { '?' };
    Ok(format!("{rendered_url}{separator}{encoded_query}"))
}

/// The endpoint's headers over the defaults; header names are sent in lowercase.
fn render_headers(
    part_renderer: &mut RequestPartRenderer,
    request_settings: &EndpointRequestSettings,
    default_headers: BTreeMap<String, String>,
) -> BTreeMap<String, String> {
    let mut headers = default_headers;
    for (header_index, (header_name, header_template)) in
        request_settings.headers.iter().enumerate()
    {
        let source = format!("header.{header_index}");
        let rendered_value =
            part_renderer.render_part(header_template, &source, TemplateEscape::None);
        if rendered_value.contains(['\r', '\n']) {
            part_renderer.problems.push(RenderProblem::error(
                format!("{header_name} renders a line break, which a header cannot hold"),
                &source,
            ));
        }
        headers.insert(header_name.to_ascii_lowercase(), rendered_value);
    }
    headers
}

/// What an endpoint request is rendered from.
pub struct EndpointRequestSource<'source> {
    pub url_template: &'source str,
    pub request_settings: &'source EndpointRequestSettings,
    /// The payload template of Template mode; None in the other body modes.
    pub endpoint_template: Option<&'source EndpointTemplate>,
}

/// Renders the whole request; the problems stay on the part renderer. Headers layer as the
/// defaults, then a payload template's headers, then the endpoint's own.
pub fn render_endpoint_request(
    part_renderer: &mut RequestPartRenderer,
    request_source: &EndpointRequestSource,
    app_event: &AppEvent,
    sendmock_version: &str,
) -> Result<RecordedHttpRequest, OperationError> {
    let request_settings = request_source.request_settings;
    let url = render_url(part_renderer, request_source.url_template, request_settings)?;
    let rendered_body = render_endpoint_body(
        part_renderer,
        request_settings,
        request_source.endpoint_template,
        app_event,
    )?;
    let mut default_headers = BTreeMap::from([(
        "user-agent".to_owned(),
        format!("sendmock/{sendmock_version}"),
    )]);
    if let Some(content_type) = rendered_body.content_type {
        default_headers.insert("content-type".to_owned(), content_type);
    }
    default_headers.extend(rendered_body.template_headers);
    let headers = render_headers(part_renderer, request_settings, default_headers);
    let method = serde_json::to_value(request_settings.method)
        .ok()
        .and_then(|method| method.as_str().map(str::to_owned))
        .unwrap_or_else(|| "POST".to_owned());
    Ok(RecordedHttpRequest {
        method,
        url,
        headers,
        body: rendered_body.body,
    })
}
