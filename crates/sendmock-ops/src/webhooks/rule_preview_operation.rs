use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::{EmailListFilter, SmsListFilter};
use sendmock_webhooks::{FilterExpression, RuleMessage};
use serde::Serialize;

use super::rule_inputs::RulePreviewRequest;
use super::rule_messages::{build_email_rule_message, build_sms_rule_message};
use super::rule_validation::{validate_rule_events, validate_rule_filter};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

const PREVIEW_MESSAGE_LIMIT: u32 = 50;

#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct RulePreviewItem {
    /// `email` or `sms`.
    pub message_kind: String,
    pub message_id: String,
    pub title: String,
    pub detail: String,
    pub created_at: String,
    pub is_match: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct RulePreviewResult {
    pub checked_count: u32,
    pub match_count: u32,
    pub items: Vec<RulePreviewItem>,
}

/// A recent message with the fields its filter reads.
struct PreviewCandidate {
    created_at_unix_ms: i64,
    rule_message: RuleMessage,
    preview_item: RulePreviewItem,
}

async fn load_email_candidates(
    operation_context: &OperationContext,
) -> Result<Vec<PreviewCandidate>, OperationError> {
    let email_page = operation_context
        .email_repository
        .list_emails(EmailListFilter::default(), None, PREVIEW_MESSAGE_LIMIT)
        .await?;
    Ok(email_page
        .emails
        .iter()
        .map(|stored_email| PreviewCandidate {
            created_at_unix_ms: stored_email.received_at_unix_ms,
            rule_message: build_email_rule_message(stored_email),
            preview_item: RulePreviewItem {
                message_kind: "email".to_owned(),
                message_id: stored_email.email_id.clone(),
                title: if stored_email.subject.is_empty() {
                    "(no subject)".to_owned()
                } else {
                    stored_email.subject.clone()
                },
                detail: stored_email.from.address.clone(),
                created_at: format_rfc3339(stored_email.received_at_unix_ms),
                is_match: false,
            },
        })
        .collect())
}

async fn load_sms_candidates(
    operation_context: &OperationContext,
) -> Result<Vec<PreviewCandidate>, OperationError> {
    let sms_page = operation_context
        .sms_repository
        .list_messages(SmsListFilter::default(), None, PREVIEW_MESSAGE_LIMIT)
        .await?;
    Ok(sms_page
        .messages
        .iter()
        .map(|stored_sms| PreviewCandidate {
            created_at_unix_ms: stored_sms.created_at_unix_ms,
            rule_message: build_sms_rule_message(stored_sms),
            preview_item: RulePreviewItem {
                message_kind: "sms".to_owned(),
                message_id: stored_sms.sms_id.clone(),
                title: stored_sms.body.clone(),
                detail: format!("{} to {}", stored_sms.from_number, stored_sms.to_number),
                created_at: format_rfc3339(stored_sms.created_at_unix_ms),
                is_match: false,
            },
        })
        .collect())
}

pub struct PreviewWebhookRuleOperation;

impl Operation for PreviewWebhookRuleOperation {
    type Input = RulePreviewRequest;
    type Output = RulePreviewResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postWebhooksRulesPreview",
            method: HttpMethod::Post,
            path: "/api/v1/webhooks/rules/preview",
            summary: "Which recent messages an unsaved rule would match.",
            is_read_only: true,
            cli_usage: "sendmock webhook rule preview",
            mcp_tool: "sendmock_webhook_rule_preview",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Which of the last 50 emails and SMS the selected events are about pass the filter
    /// (WH-02.3).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: RulePreviewRequest,
    ) -> Result<RulePreviewResult, OperationError> {
        validate_rule_events(&input.events)?;
        validate_rule_filter(input.filter.as_ref())?;
        let is_about = |prefix: &str| {
            input
                .events
                .iter()
                .any(|event_type| event_type.starts_with(prefix))
        };
        let mut candidates = Vec::new();
        if is_about("email.") {
            candidates.extend(load_email_candidates(operation_context).await?);
        }
        if is_about("sms.") {
            candidates.extend(load_sms_candidates(operation_context).await?);
        }
        candidates.sort_by_key(|candidate| std::cmp::Reverse(candidate.created_at_unix_ms));
        candidates.truncate(PREVIEW_MESSAGE_LIMIT as usize);
        let filter_expression = input.filter.as_ref().map(FilterExpression::from);
        let items: Vec<RulePreviewItem> = candidates
            .into_iter()
            .map(|candidate| RulePreviewItem {
                is_match: filter_expression.as_ref().is_none_or(|filter_expression| {
                    filter_expression.matches(&candidate.rule_message)
                }),
                ..candidate.preview_item
            })
            .collect();
        let match_count = items
            .iter()
            .filter(|preview_item| preview_item.is_match)
            .count();
        Ok(RulePreviewResult {
            checked_count: u32::try_from(items.len()).unwrap_or(u32::MAX),
            match_count: u32::try_from(match_count).unwrap_or(u32::MAX),
            items,
        })
    }
}
