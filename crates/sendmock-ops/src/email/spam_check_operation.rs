use schemars::JsonSchema;
use sendmock_mail::{SpamdReport, decompress_raw_message};
use serde::Serialize;

use super::email_inputs::EmailReference;
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, OperationSelector,
};

/// SpamAssassin's own default for `required_score`, shown while no spamd answers.
const DEFAULT_SPAM_THRESHOLD: f64 = 5.0;

/// One SpamAssassin rule the message triggered.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct SpamCheckRule {
    pub name: String,
    pub score: f64,
    pub description: String,
}

/// The spam score from SpamAssassin (EM-13.3).
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct SpamCheckReport {
    /// False when no SpamAssassin server is configured.
    pub is_available: bool,
    #[schemars(required, schema_with = "crate::nullable_schema::<f64>")]
    pub score: Option<f64>,
    pub threshold: f64,
    pub rules: Vec<SpamCheckRule>,
}

impl SpamCheckReport {
    fn unavailable() -> Self {
        Self {
            is_available: false,
            score: None,
            threshold: DEFAULT_SPAM_THRESHOLD,
            rules: Vec::new(),
        }
    }

    fn from_spamd_report(spamd_report: SpamdReport) -> Self {
        Self {
            is_available: true,
            score: Some(spamd_report.score),
            threshold: spamd_report.threshold,
            rules: spamd_report
                .rules
                .into_iter()
                .map(|spamd_rule| SpamCheckRule {
                    name: spamd_rule.name,
                    score: spamd_rule.score,
                    description: spamd_rule.description,
                })
                .collect(),
        }
    }
}

pub struct CheckEmailSpamOperation;

impl Operation for CheckEmailSpamOperation {
    type Input = EmailReference;
    type Output = SpamCheckReport;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postEmailsByEmailIdSpamCheck",
            method: HttpMethod::Post,
            path: "/api/v1/emails/{emailId}/spam-check",
            summary: "Score the message with SpamAssassin, when a spamd address is set.",
            cli_usage: "sendmock email check <emailId> spam",
            mcp_tool: "sendmock_email_check",
            is_read_only: true,
            selector: Some(OperationSelector::by_value("kind", "spam")),
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailReference,
    ) -> Result<SpamCheckReport, OperationError> {
        let compressed_raw_message = operation_context
            .email_repository
            .read_compressed_raw_message(&input.email_id)
            .await?
            .ok_or_else(|| OperationError::NotFound {
                message: format!("No email with id {}", input.email_id),
            })?;
        let app_settings = operation_context.settings_store.current().await?;
        let (Some(spamd_address), Some(spam_checker)) = (
            app_settings.spamassassin_address,
            &operation_context.email_checkers.spam_checker,
        ) else {
            return Ok(SpamCheckReport::unavailable());
        };
        let raw_message = decompress_raw_message(&compressed_raw_message)
            .map_err(|decode_error| OperationError::Internal(decode_error.to_string()))?;
        let spamd_report = spam_checker
            .request_spam_report(&spamd_address, &raw_message)
            .await
            .map_err(|spamd_error| OperationError::Upstream {
                code: "spamassassin_unavailable",
                message: format!("SpamAssassin at {spamd_address} did not answer: {spamd_error}"),
            })?;
        Ok(SpamCheckReport::from_spamd_report(spamd_report))
    }
}
