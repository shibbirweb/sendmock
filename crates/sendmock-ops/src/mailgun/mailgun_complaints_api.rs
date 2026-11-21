use sendmock_core::format_rfc5322;
use sendmock_store::{MailgunComplaintRecord, MailgunComplaintRepository};
use serde_json::{Value, json};

use crate::providers::{
    ProviderHttpRequest, ProviderHttpResponse, answer_json, read_request_fields,
};
use crate::{OperationContext, OperationError};

fn describe_complaint(complaint: &MailgunComplaintRecord) -> Value {
    json!({
        "address": complaint.address,
        "created_at": format_rfc5322(complaint.created_at_unix_ms),
    })
}

fn answer_not_found() -> ProviderHttpResponse {
    answer_json(
        404,
        json!({ "message": "No spam complaints found for this address" }),
    )
}

/// Mailgun's complaints table for one domain: `GET` and `POST /v3/{domain}/complaints`,
/// `GET` and `DELETE /v3/{domain}/complaints/{address}`, and `DELETE` of the whole table.
pub async fn answer_complaints(
    operation_context: &OperationContext,
    domain: &str,
    address: Option<&str>,
    request: &ProviderHttpRequest,
    base_url: &str,
) -> Result<Option<ProviderHttpResponse>, OperationError> {
    let complaints = &operation_context.email_stores.mailgun_complaints;
    let response = match (request.method.as_str(), address) {
        ("GET", None) => {
            let listed: Vec<Value> = complaints
                .list_complaints(Some(domain))
                .await?
                .iter()
                .map(describe_complaint)
                .collect();
            let page_url = format!("{base_url}/v3/{domain}/complaints");
            answer_json(
                200,
                json!({
                    "items": listed,
                    "paging": { "first": page_url, "last": page_url, "next": page_url, "previous": page_url },
                }),
            )
        }
        ("POST", None) => add_complaint(operation_context, complaints, domain, request).await?,
        ("DELETE", None) => {
            complaints.delete_domain_complaints(domain).await?;
            answer_json(
                200,
                json!({ "message": "Complaint addresses for this domain have been removed" }),
            )
        }
        ("GET", Some(address)) => match complaints.find_complaint(domain, address).await? {
            Some(complaint) => answer_json(200, describe_complaint(&complaint)),
            None => answer_not_found(),
        },
        ("DELETE", Some(address)) => {
            if complaints.delete_complaint(domain, address).await? {
                answer_json(
                    200,
                    json!({ "message": "Spam complaint has been removed", "address": address }),
                )
            } else {
                answer_not_found()
            }
        }
        _ => return Ok(None),
    };
    Ok(Some(response))
}

async fn add_complaint(
    operation_context: &OperationContext,
    complaints: &MailgunComplaintRepository,
    domain: &str,
    request: &ProviderHttpRequest,
) -> Result<ProviderHttpResponse, OperationError> {
    let fields = read_request_fields(request, "form").unwrap_or_default();
    let Some(address) = fields["address"]
        .as_str()
        .map(str::trim)
        .filter(|address| address.contains('@'))
    else {
        return Ok(answer_json(
            400,
            json!({ "message": "address is required" }),
        ));
    };
    complaints
        .add_complaint(MailgunComplaintRecord {
            domain: domain.to_owned(),
            address: address.to_owned(),
            created_at_unix_ms: operation_context.clock.now_unix_ms(),
        })
        .await?;
    Ok(answer_json(
        200,
        json!({ "message": "Address has been added to the complaints table", "address": address }),
    ))
}
