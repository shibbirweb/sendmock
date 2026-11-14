//! How well email clients render an email's HTML: the features clients disagree on, matched in
//! the body and scored from caniemail's support data.

use std::sync::LazyLock;

use regex::RegexBuilder;
use serde::Deserialize;

const HTML_FEATURES_JSON: &str = include_str!("../html-features.json");

#[derive(Deserialize)]
struct FeatureTable {
    clients: Vec<String>,
    features: Vec<FeatureEntry>,
}

#[derive(Deserialize)]
struct FeatureEntry {
    feature: String,
    pattern: String,
    /// Support per client, in the table's client order, as a percentage.
    support: Vec<u8>,
}

static FEATURE_TABLE: LazyLock<FeatureTable> = LazyLock::new(|| {
    serde_json::from_str(HTML_FEATURES_JSON).unwrap_or(FeatureTable {
        clients: Vec::new(),
        features: Vec::new(),
    })
});

/// One client's support for the whole email: the lowest of the features it uses.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClientSupport {
    pub client: String,
    pub support_percent: u8,
}

/// A feature the email uses that some client does not fully support.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CompatibilityWarning {
    pub feature: String,
    /// The mean support across clients.
    pub support_percent: u8,
    /// The first line of the HTML using it.
    pub line: Option<u32>,
    pub note: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HtmlCompatibilityReport {
    pub overall_support_percent: u8,
    pub clients: Vec<ClientSupport>,
    pub warnings: Vec<CompatibilityWarning>,
}

fn find_first_line(html_body: &str, pattern: &regex::Regex) -> Option<u32> {
    html_body
        .lines()
        .position(|line| pattern.is_match(line))
        .and_then(|line_index| u32::try_from(line_index + 1).ok())
}

fn mean_percent(percentages: &[u8]) -> u8 {
    if percentages.is_empty() {
        return 100;
    }
    let total: u32 = percentages.iter().map(|percent| u32::from(*percent)).sum();
    let count = u32::try_from(percentages.len()).unwrap_or(1);
    u8::try_from((total + count / 2) / count).unwrap_or(100)
}

fn describe_gaps(entry: &FeatureEntry, clients: &[String]) -> String {
    let lacking: Vec<String> = clients
        .iter()
        .zip(&entry.support)
        .filter(|(_, support)| **support < 100)
        .map(|(client, support)| {
            if *support == 0 {
                format!("{client} (not supported)")
            } else {
                format!("{client} ({support}%)")
            }
        })
        .collect();
    format!("Not fully supported in {}.", lacking.join(", "))
}

/// The report for an HTML body; an email without HTML is fully supported.
pub fn check_html_compatibility(html_body: &str) -> HtmlCompatibilityReport {
    let table = &*FEATURE_TABLE;
    let mut client_support = vec![100_u8; table.clients.len()];
    let mut warnings = Vec::new();
    for entry in &table.features {
        let Ok(pattern) = RegexBuilder::new(&entry.pattern)
            .case_insensitive(true)
            .build()
        else {
            continue;
        };
        if !pattern.is_match(html_body) {
            continue;
        }
        for (client_percent, feature_percent) in client_support.iter_mut().zip(&entry.support) {
            *client_percent = (*client_percent).min(*feature_percent);
        }
        if entry.support.iter().any(|support| *support < 100) {
            warnings.push(CompatibilityWarning {
                feature: entry.feature.clone(),
                support_percent: mean_percent(&entry.support),
                line: find_first_line(html_body, &pattern),
                note: describe_gaps(entry, &table.clients),
            });
        }
    }
    HtmlCompatibilityReport {
        overall_support_percent: mean_percent(&client_support),
        clients: table
            .clients
            .iter()
            .zip(client_support)
            .map(|(client, support_percent)| ClientSupport {
                client: client.clone(),
                support_percent,
            })
            .collect(),
        warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: EM-13.1
    #[test]
    fn flexbox_and_web_fonts_lower_the_clients_that_lack_them_with_their_lines() {
        let html_body = "<html>\n<style>@font-face { font-family: Brand; }</style>\n<div style=\"display: flex\">Hi</div>\n</html>";

        let report = check_html_compatibility(html_body);

        let outlook = report
            .clients
            .iter()
            .find(|client| client.client == "Outlook (Windows)")
            .map(|client| client.support_percent);
        let apple = report
            .clients
            .iter()
            .find(|client| client.client == "Apple Mail")
            .map(|client| client.support_percent);
        assert_eq!((outlook, apple), (Some(0), Some(100)));
        let features: Vec<(&str, Option<u32>)> = report
            .warnings
            .iter()
            .map(|warning| (warning.feature.as_str(), warning.line))
            .collect();
        assert_eq!(
            features,
            vec![
                ("CSS display: flex", Some(3)),
                ("@font-face web fonts", Some(2))
            ]
        );
        assert!(
            report.warnings[0]
                .note
                .contains("Outlook (Windows) (not supported)")
        );
        assert!(report.overall_support_percent < 100);
    }

    #[test]
    fn a_plain_table_layout_is_fully_supported() {
        let report = check_html_compatibility("<table><tr><td>Hi</td></tr></table>");

        assert_eq!(report.overall_support_percent, 100);
        assert!(report.warnings.is_empty());
        assert_eq!(report.clients.len(), 6);
    }
}
