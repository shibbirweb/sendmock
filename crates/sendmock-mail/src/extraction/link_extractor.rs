use std::sync::LazyLock;

use regex::Regex;

static LINK_PATTERN: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r#"https?://[^\s<>"'\)\]]+"#).ok());

/// Every http and https link in the text and HTML bodies, first seen first, without repeats.
pub fn extract_links(text_body: Option<&str>, html_body: Option<&str>) -> Vec<String> {
    let Some(link_pattern) = LINK_PATTERN.as_ref() else {
        return Vec::new();
    };
    let mut links: Vec<String> = Vec::new();
    for body in [text_body, html_body].into_iter().flatten() {
        for link_match in link_pattern.find_iter(body) {
            let link = link_match
                .as_str()
                .replace("&amp;", "&")
                .trim_end_matches(['.', ',', ';', ':', '!', '?'])
                .to_owned();
            if !links.contains(&link) {
                links.push(link);
            }
        }
    }
    links
}

static REMOTE_IMAGE_PATTERN: std::sync::LazyLock<Option<regex::Regex>> =
    std::sync::LazyLock::new(|| {
        regex::Regex::new(r#"(?i)<img[^>]+src\s*=\s*["'](https?://[^"']+)["']"#).ok()
    });

/// The `http` and `https` image sources of an HTML body in order; inline `cid:` images and data
/// URLs are not fetched by mail clients, so they are left out.
pub fn extract_remote_image_urls(html_body: &str) -> Vec<String> {
    REMOTE_IMAGE_PATTERN
        .as_ref()
        .map(|image_pattern| {
            image_pattern
                .captures_iter(html_body)
                .map(|image_captures| image_captures[1].to_owned())
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: EM-05.2
    #[test]
    fn lists_links_from_both_bodies_once() {
        let links = extract_links(
            Some("Reset it: https://app.test/reset?token=abc. Thanks"),
            Some(
                r#"<a href="https://app.test/reset?token=abc">Reset</a> <a href='https://app.test/help?a=1&amp;b=2'>Help</a>"#,
            ),
        );

        assert_eq!(
            links,
            [
                "https://app.test/reset?token=abc",
                "https://app.test/help?a=1&b=2"
            ]
        );
    }

    // AC: EM-13.2
    #[test]
    fn lists_remote_image_sources_and_leaves_out_inline_images() {
        let image_urls = extract_remote_image_urls(
            r#"<img src="https://cdn.app.test/logo.png"> <IMG alt="x" SRC='http://cdn.app.test/a.gif'> <img src="cid:part1"> <img src="data:image/png;base64,AA==">"#,
        );

        assert_eq!(
            image_urls,
            ["https://cdn.app.test/logo.png", "http://cdn.app.test/a.gif"]
        );
    }
}
