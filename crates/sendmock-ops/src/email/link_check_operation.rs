use schemars::JsonSchema;
use sendmock_mail::extract_remote_image_urls;
use serde::Serialize;

use super::email_access::find_email_or_not_found;
use super::email_inputs::EmailReference;
use super::link_checker::LinkProbe;
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, OperationSelector,
};

/// Enough for any real email; a body with more links is trimmed, not refused.
const MAXIMUM_CHECKED_URLS: usize = 100;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum LinkKind {
    Link,
    Image,
}

/// One link or image and what requesting it answered (EM-13.2).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct LinkCheckResult {
    pub url: String,
    pub kind: LinkKind,
    #[schemars(required, schema_with = "crate::nullable_schema::<u16>")]
    pub status_code: Option<u16>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub redirect_url: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<u32>")]
    pub duration_ms: Option<u32>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub error_message: Option<String>,
}

/// The email's links, then its remote images, each once; a URL that is an image source is an
/// image even when the link list holds it too.
fn list_checked_urls(links: &[String], html_body: &str) -> Vec<(String, LinkKind)> {
    let image_urls = extract_remote_image_urls(html_body);
    let read_kind = |url: &String| {
        if image_urls.contains(url) {
            LinkKind::Image
        } else {
            LinkKind::Link
        }
    };
    let mut checked_urls: Vec<(String, LinkKind)> = Vec::new();
    for url in links.iter().chain(&image_urls) {
        if !checked_urls
            .iter()
            .any(|(checked_url, _)| checked_url == url)
        {
            checked_urls.push((url.clone(), read_kind(url)));
        }
    }
    checked_urls.truncate(MAXIMUM_CHECKED_URLS);
    checked_urls
}

pub struct CheckEmailLinksOperation;

impl Operation for CheckEmailLinksOperation {
    type Input = EmailReference;
    type Output = Vec<LinkCheckResult>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postEmailsByEmailIdLinkCheck",
            method: HttpMethod::Post,
            path: "/api/v1/emails/{emailId}/link-check",
            summary: "Check every link in the message.",
            cli_usage: "sendmock email check <emailId> links",
            mcp_tool: "sendmock_email_check",
            is_read_only: true,
            selector: Some(OperationSelector::by_value("kind", "links")),
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailReference,
    ) -> Result<Vec<LinkCheckResult>, OperationError> {
        let email = find_email_or_not_found(operation_context, &input.email_id).await?;
        let checked_urls =
            list_checked_urls(&email.links, email.html_body.as_deref().unwrap_or_default());
        let mut results = Vec::with_capacity(checked_urls.len());
        for (url, kind) in checked_urls {
            let probe = match &operation_context.email_network_clients.link_checker {
                Some(link_checker) => link_checker.probe_link(&url).await,
                None => LinkProbe {
                    error_message: Some("Link checks are not available in this build".to_owned()),
                    ..LinkProbe::default()
                },
            };
            results.push(LinkCheckResult {
                url,
                kind,
                status_code: probe.status_code,
                redirect_url: probe.redirect_url,
                duration_ms: probe.duration_ms,
                error_message: probe.error_message,
            });
        }
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_image_source_in_the_link_list_is_checked_as_an_image() {
        let links = vec!["https://cdn.shop.test/logo.png".to_owned()];
        let html_body = r#"<img src="https://cdn.shop.test/logo.png">"#;

        let checked_urls = list_checked_urls(&links, html_body);

        assert_eq!(
            checked_urls,
            vec![("https://cdn.shop.test/logo.png".to_owned(), LinkKind::Image)]
        );
    }

    #[test]
    fn links_then_remote_images_are_checked_once_each() {
        let links = vec![
            "https://shop.test/verify".to_owned(),
            "https://shop.test/verify".to_owned(),
        ];
        let html_body = r#"<img src="https://cdn.shop.test/logo.png"><img src="cid:inline">"#;

        let checked_urls = list_checked_urls(&links, html_body);

        assert_eq!(
            checked_urls,
            vec![
                ("https://shop.test/verify".to_owned(), LinkKind::Link),
                ("https://cdn.shop.test/logo.png".to_owned(), LinkKind::Image),
            ]
        );
    }
}
