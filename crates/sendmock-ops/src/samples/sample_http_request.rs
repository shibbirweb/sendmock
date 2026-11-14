use std::collections::BTreeMap;

use super::create_sample_operation::CreatedSample;
use crate::{IncomingHttpRequest, OperationContext, OperationError, capture_http_request};

/// A Slack notification captured in the `slack` bin, as an app would send it (PL-03.5).
pub async fn create_sample_http_request(
    operation_context: &OperationContext,
) -> Result<CreatedSample, OperationError> {
    let http_address = &operation_context.instance_details.http_address;
    let catch_answer = capture_http_request(
        operation_context,
        IncomingHttpRequest {
            method: "POST".to_owned(),
            url: format!("http://{http_address}/catch/slack"),
            path: "/catch/slack".to_owned(),
            query_string: None,
            headers: BTreeMap::from([
                ("content-type".to_owned(), "application/json".to_owned()),
                ("user-agent".to_owned(), "acme-app/1.0".to_owned()),
            ]),
            body: br#"{"text":"New signup: *ayesha@example.com* on the _Pro_ plan"}"#.to_vec(),
            client_ip: "127.0.0.1".to_owned(),
        },
    )
    .await?;
    Ok(CreatedSample {
        kind: "http".to_owned(),
        id: catch_answer.request_id,
    })
}
