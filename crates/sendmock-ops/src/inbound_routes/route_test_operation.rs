use sendmock_mail::match_route_filter;
use sendmock_store::EmailListFilter;

use super::route_records::to_routable_email;
use super::route_wire::{InboundRouteMatch, InboundRouteTestRequest, InboundRouteTestResult};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

/// Mailgun's route preview reads the most recent incoming emails.
const RECENT_INCOMING_LIMIT: u32 = 50;

pub struct TestInboundRouteOperation;

impl Operation for TestInboundRouteOperation {
    type Input = InboundRouteTestRequest;
    type Output = InboundRouteTestResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postInboundRoutesTest",
            method: HttpMethod::Post,
            path: "/api/v1/inbound-routes/test",
            summary: "Which routes a recipient or header would match, and what runs.",
            is_read_only: true,
            cli_usage: "sendmock route test",
            mcp_tool: "sendmock_inbound_route_test",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// The filter tried on the last 50 incoming emails, with the groups each captured.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: InboundRouteTestRequest,
    ) -> Result<InboundRouteTestResult, OperationError> {
        let recent_incoming = operation_context
            .email_repository
            .list_emails(
                EmailListFilter {
                    direction: Some("inbound".to_owned()),
                    ..EmailListFilter::default()
                },
                None,
                RECENT_INCOMING_LIMIT,
            )
            .await?
            .emails;
        let filter_rule = input.filter.to_filter_rule();
        let matches = recent_incoming
            .iter()
            .filter_map(|incoming_email| {
                let route_match =
                    match_route_filter(&filter_rule, &to_routable_email(incoming_email))?;
                Some(InboundRouteMatch {
                    email_id: incoming_email.email_id.clone(),
                    from: incoming_email.from.address.clone(),
                    matched_value: route_match.matched_value,
                    subject: incoming_email.subject.clone(),
                    captured_groups: route_match.captured_groups,
                })
            })
            .collect();
        Ok(InboundRouteTestResult {
            checked_count: recent_incoming.len(),
            matches,
        })
    }
}
