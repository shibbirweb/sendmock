use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::Serialize;

/// The `List-Unsubscribe` and one-click checks of RFC 2369 and RFC 8058.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct ListUnsubscribeReport {
    pub has_header: bool,
    /// Every `<...>` value of the header, `mailto:` and `https:` alike.
    pub values: Vec<String>,
    pub supports_one_click: bool,
    pub warnings: Vec<String>,
}

const ONE_CLICK_POST_VALUE: &str = "List-Unsubscribe=One-Click";

pub fn check_list_unsubscribe(headers: &BTreeMap<String, Vec<String>>) -> ListUnsubscribeReport {
    let header_value = find_header(headers, "List-Unsubscribe");
    let post_value = find_header(headers, "List-Unsubscribe-Post");
    let Some(header_value) = header_value else {
        return ListUnsubscribeReport {
            has_header: false,
            values: Vec::new(),
            supports_one_click: false,
            warnings: vec!["No List-Unsubscribe header: mailbox providers may treat bulk mail without it as spam.".to_owned()],
        };
    };
    let mut warnings = Vec::new();
    let values: Vec<String> = header_value
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| {
            if !(value.starts_with('<') && value.ends_with('>')) {
                warnings.push(format!(
                    "{value} must be written in angle brackets, as <{value}>."
                ));
            }
            value.trim_matches(['<', '>']).to_owned()
        })
        .collect();
    let has_https_value = values.iter().any(|value| value.starts_with("https://"));
    let has_one_click_post =
        post_value.is_some_and(|post_value| post_value.trim() == ONE_CLICK_POST_VALUE);
    if post_value.is_some() && !has_one_click_post {
        warnings.push(format!(
            "List-Unsubscribe-Post must be exactly \"{ONE_CLICK_POST_VALUE}\"."
        ));
    }
    if has_one_click_post && !has_https_value {
        warnings.push("One-click unsubscribe needs an https: URL in List-Unsubscribe.".to_owned());
    }
    if values.iter().any(|value| value.starts_with("http://")) {
        warnings.push("Use https: rather than http: for unsubscribe links.".to_owned());
    }
    ListUnsubscribeReport {
        has_header: true,
        supports_one_click: has_one_click_post && has_https_value,
        values,
        warnings,
    }
}

fn find_header<'header>(
    headers: &'header BTreeMap<String, Vec<String>>,
    header_name: &str,
) -> Option<&'header str> {
    headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case(header_name))
        .and_then(|(_, values)| values.first())
        .map(String::as_str)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(pairs: &[(&str, &str)]) -> BTreeMap<String, Vec<String>> {
        pairs
            .iter()
            .map(|(name, value)| ((*name).to_owned(), vec![(*value).to_owned()]))
            .collect()
    }

    // AC: EM-13.4
    #[test]
    fn accepts_a_valid_one_click_header() {
        let report = check_list_unsubscribe(&headers(&[
            (
                "List-Unsubscribe",
                "<mailto:unsub@shop.test>, <https://shop.test/u?t=1>",
            ),
            ("List-Unsubscribe-Post", "List-Unsubscribe=One-Click"),
        ]));

        assert!(report.supports_one_click);
        assert_eq!(
            report.values,
            ["mailto:unsub@shop.test", "https://shop.test/u?t=1"]
        );
        assert!(report.warnings.is_empty());
    }

    // AC: EM-13.4
    #[test]
    fn warns_about_invalid_headers() {
        let report = check_list_unsubscribe(&headers(&[
            ("List-Unsubscribe", "http://shop.test/u"),
            ("List-Unsubscribe-Post", "yes"),
        ]));

        assert!(!report.supports_one_click);
        assert_eq!(report.warnings.len(), 3);
    }

    #[test]
    fn reports_a_missing_header() {
        let report = check_list_unsubscribe(&BTreeMap::new());

        assert!(!report.has_header);
        assert_eq!(report.warnings.len(), 1);
    }
}
