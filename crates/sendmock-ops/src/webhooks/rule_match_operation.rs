use std::collections::BTreeMap;

use sendmock_webhooks::{HEADER_FIELD_PREFIX, RuleMessage};

use sendmock_store::{WebhookEndpointRecord, WebhookRuleRecord};

use super::rule_event_subject::{is_ruled_event, load_subject_rule_message};
use super::rule_match_requests::{build_matched_event, render_matched_request};
use super::rule_match_wire::{
    MatchedWebhookRequest, MatchedWebhookRule, WebhookRuleMatchRequest, WebhookRuleMatchResult,
};
use super::rule_subscriber::find_firing_rules;
use super::rule_validation::validate_rule_event;
use super::webhook_choice_input::check_endpoint_can_be_chosen;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

pub struct MatchWebhookRulesOperation;

impl Operation for MatchWebhookRulesOperation {
    type Input = WebhookRuleMatchRequest;
    type Output = WebhookRuleMatchResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postWebhooksRulesMatch",
            method: HttpMethod::Post,
            path: "/api/v1/webhooks/rules/match",
            summary: "Which webhooks an event would trigger, before an action fires it.",
            is_read_only: true,
            cli_usage: "sendmock webhook rule match",
            mcp_tool: "sendmock_webhook_rule_match",
            // `--data` is every command's JSON body flag.
            cli_flag_names: &[("data", "field"), ("webhook_endpoint_ids", "webhook")],
            ..OperationDefinition::DEFAULTS
        }
    }

    /// The rule matcher dispatch runs, and with `include_requests` each endpoint's rendered
    /// request, with nothing stored or sent (WH-13.1, WH-14.1).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookRuleMatchRequest,
    ) -> Result<WebhookRuleMatchResult, OperationError> {
        validate_rule_event(&input.event_type)?;
        if !is_ruled_event(&input.event_type) {
            return Ok(WebhookRuleMatchResult {
                webhook_rules: Vec::new(),
                webhook_requests: input.include_requests.unwrap_or_default().then(Vec::new),
            });
        }
        let stored_message = match &input.subject_id {
            Some(subject_id) => {
                load_subject_rule_message(operation_context, &input.event_type, subject_id).await?
            }
            None => RuleMessage::default(),
        };
        let rule_message =
            overlay_event_fields(stored_message, input.data.clone().unwrap_or_default());
        let stored_rules = operation_context
            .webhook_rule_repository
            .list_rules()
            .await?;
        let firing_rules = find_firing_rules(
            operation_context,
            stored_rules,
            &input.event_type,
            &rule_message,
        )
        .await?;
        let webhook_requests = if input.include_requests.unwrap_or_default() {
            Some(render_action_requests(operation_context, &input, &firing_rules).await?)
        } else {
            None
        };
        let webhook_rules = firing_rules
            .into_iter()
            .map(|(stored_rule, stored_endpoint)| MatchedWebhookRule {
                rule_id: stored_rule.rule_id,
                rule_name: stored_rule.name,
                endpoint_id: stored_endpoint.endpoint_id,
                endpoint_name: stored_endpoint.name,
                endpoint_url: stored_endpoint.url,
            })
            .collect();
        Ok(WebhookRuleMatchResult {
            webhook_rules,
            webhook_requests,
        })
    }
}

/// The request of each matching endpoint, then of each chosen one not already shown.
async fn render_action_requests(
    operation_context: &OperationContext,
    input: &WebhookRuleMatchRequest,
    firing_rules: &[(WebhookRuleRecord, WebhookEndpointRecord)],
) -> Result<Vec<MatchedWebhookRequest>, OperationError> {
    let matched_event = build_matched_event(
        operation_context,
        &input.event_type,
        input.subject_id.as_deref(),
    )
    .await?;
    let mut webhook_requests: Vec<MatchedWebhookRequest> = Vec::new();
    for (stored_rule, stored_endpoint) in firing_rules {
        if webhook_requests
            .iter()
            .any(|shown_request| shown_request.endpoint_id == stored_endpoint.endpoint_id)
        {
            continue;
        }
        webhook_requests.push(
            render_matched_request(
                operation_context,
                stored_endpoint,
                &matched_event,
                Some(&stored_rule.rule_id),
            )
            .await?,
        );
    }
    for endpoint_id in input.webhook_endpoint_ids.iter().flatten() {
        check_endpoint_can_be_chosen(operation_context, endpoint_id).await?;
        if webhook_requests
            .iter()
            .any(|shown_request| &shown_request.endpoint_id == endpoint_id)
        {
            continue;
        }
        let Some(stored_endpoint) = operation_context
            .webhook_endpoint_repository
            .find_endpoint(endpoint_id)
            .await?
        else {
            continue;
        };
        webhook_requests.push(
            render_matched_request(operation_context, &stored_endpoint, &matched_event, None)
                .await?,
        );
    }
    Ok(webhook_requests)
}

/// The fields the caller gave win over the stored message's; `header:<name>` sets a header.
fn overlay_event_fields(
    rule_message: RuleMessage,
    event_fields: BTreeMap<String, Vec<String>>,
) -> RuleMessage {
    event_fields.into_iter().fold(
        rule_message,
        |rule_message, (field_key, values)| match field_key.strip_prefix(HEADER_FIELD_PREFIX) {
            Some(header_name) => rule_message.with_header(header_name, values),
            None => rule_message.with_field(&field_key, values),
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn given_fields_win_over_the_stored_message() {
        let stored_message = RuleMessage::default()
            .with_field("open_count", vec!["1".to_owned()])
            .with_field("subject", vec!["Your receipt".to_owned()]);

        let rule_message = overlay_event_fields(
            stored_message,
            BTreeMap::from([
                ("open_count".to_owned(), vec!["2".to_owned()]),
                ("header:x-tenant".to_owned(), vec!["acme".to_owned()]),
            ]),
        );

        assert_eq!(
            rule_message.read_field("open_count"),
            Some(vec!["2".to_owned()])
        );
        assert_eq!(
            rule_message.read_field("subject"),
            Some(vec!["Your receipt".to_owned()])
        );
        assert_eq!(
            rule_message.read_field("header:x-tenant"),
            Some(vec!["acme".to_owned()])
        );
    }
}
