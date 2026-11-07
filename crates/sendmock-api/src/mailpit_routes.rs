//! Mailpit's REST API paths on the main port (EM-19), so a test suite written against Mailpit
//! reads SendMock's mail with no change. Each handler reads the request, calls the Mailpit
//! adapter in `sendmock-ops` and writes Mailpit's answer: JSON, `ok`, or a plain text error.

use axum::Json;
use axum::Router;
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::http::header::CONTENT_TYPE;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use sendmock_ops::OperationContext;
use sendmock_ops::mailpit::{
    MailpitError, delete_mailpit_messages, delete_mailpit_search, list_mailpit_messages,
    list_mailpit_tags, read_mailpit_headers, read_mailpit_message, read_mailpit_part,
    read_mailpit_source, read_mailpit_view, set_mailpit_read_status, set_mailpit_tags,
};
use serde::Deserialize;
use serde::de::DeserializeOwned;

const PLAIN_TEXT: &str = "text/plain; charset=utf-8";

/// `start`, `limit` and `query`, as Mailpit reads them from the query string.
#[derive(Debug, Default, Deserialize)]
struct MailpitPageQuery {
    query: Option<String>,
    start: Option<String>,
    limit: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct MailpitReadStatusBody {
    #[serde(rename = "IDs", default)]
    message_ids: Vec<String>,
    #[serde(rename = "Read", default)]
    is_read: bool,
    #[serde(rename = "Search")]
    search_query: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct MailpitMessageIdsBody {
    #[serde(rename = "IDs", default)]
    message_ids: Vec<String>,
}

#[derive(Debug, Default, Deserialize)]
struct MailpitTagsBody {
    #[serde(rename = "IDs", default)]
    message_ids: Vec<String>,
    #[serde(rename = "Tags", default)]
    tags: Vec<String>,
}

/// The Mailpit routes, merged into the app router beside the native API.
pub fn build_mailpit_router(operation_context: &OperationContext) -> Router {
    Router::new()
        .route(
            "/api/v1/messages",
            get(list_messages)
                .put(set_read_status)
                .delete(delete_messages),
        )
        .route("/api/v1/search", get(search_messages).delete(delete_search))
        .route("/api/v1/message/{message_id}", get(read_message))
        .route("/api/v1/message/{message_id}/headers", get(read_headers))
        .route("/api/v1/message/{message_id}/raw", get(read_source))
        .route(
            "/api/v1/message/{message_id}/part/{part_id}",
            get(read_part),
        )
        .route("/api/v1/tags", get(list_tags).put(set_tags))
        .route("/view/{view_file}", get(read_view))
        .with_state(operation_context.clone())
}

fn plain_text(status_code: StatusCode, text: String) -> Response {
    (status_code, [(CONTENT_TYPE, PLAIN_TEXT)], text).into_response()
}

fn answer_error(mailpit_error: MailpitError) -> Response {
    let status_code = match mailpit_error {
        MailpitError::NotFound(_) => StatusCode::NOT_FOUND,
        MailpitError::BadRequest(_) => StatusCode::BAD_REQUEST,
        MailpitError::Failed(_) => StatusCode::INTERNAL_SERVER_ERROR,
    };
    plain_text(status_code, mailpit_error.to_string())
}

fn answer_ok(outcome: Result<(), MailpitError>) -> Response {
    match outcome {
        Ok(()) => plain_text(StatusCode::OK, "ok".to_owned()),
        Err(mailpit_error) => answer_error(mailpit_error),
    }
}

fn answer_json<T: serde::Serialize>(outcome: Result<T, MailpitError>) -> Response {
    match outcome {
        Ok(answer) => Json(answer).into_response(),
        Err(mailpit_error) => answer_error(mailpit_error),
    }
}

/// An empty body is Mailpit's "every message"; anything else must be the JSON it expects.
fn read_json_body<T: DeserializeOwned + Default>(body: &Bytes) -> Result<T, MailpitError> {
    if body.iter().all(u8::is_ascii_whitespace) {
        return Ok(T::default());
    }
    serde_json::from_slice(body)
        .map_err(|parse_error| MailpitError::BadRequest(parse_error.to_string()))
}

fn parse_number<T: std::str::FromStr>(
    name: &str,
    text: Option<&str>,
) -> Result<Option<T>, MailpitError> {
    text.filter(|text| !text.is_empty())
        .map(|text| {
            text.parse()
                .map_err(|_| MailpitError::BadRequest(format!("invalid {name}: {text}")))
        })
        .transpose()
}

async fn answer_page(
    operation_context: &OperationContext,
    page_query: MailpitPageQuery,
) -> Response {
    let paging = parse_number::<u64>("start", page_query.start.as_deref()).and_then(|start| {
        Ok((
            start.unwrap_or(0),
            parse_number::<u32>("limit", page_query.limit.as_deref())?,
        ))
    });
    let (start, limit) = match paging {
        Ok(paging) => paging,
        Err(mailpit_error) => return answer_error(mailpit_error),
    };
    answer_json(list_mailpit_messages(operation_context, page_query.query, start, limit).await)
}

async fn list_messages(
    State(operation_context): State<OperationContext>,
    Query(page_query): Query<MailpitPageQuery>,
) -> Response {
    let page_query = MailpitPageQuery {
        query: None,
        ..page_query
    };
    answer_page(&operation_context, page_query).await
}

async fn search_messages(
    State(operation_context): State<OperationContext>,
    Query(page_query): Query<MailpitPageQuery>,
) -> Response {
    answer_page(&operation_context, page_query).await
}

async fn delete_search(
    State(operation_context): State<OperationContext>,
    Query(page_query): Query<MailpitPageQuery>,
) -> Response {
    answer_ok(delete_mailpit_search(&operation_context, page_query.query).await)
}

async fn set_read_status(
    State(operation_context): State<OperationContext>,
    body: Bytes,
) -> Response {
    let outcome = match read_json_body::<MailpitReadStatusBody>(&body) {
        Ok(read_status) => {
            set_mailpit_read_status(
                &operation_context,
                read_status.message_ids,
                read_status.is_read,
                read_status.search_query,
            )
            .await
        }
        Err(mailpit_error) => Err(mailpit_error),
    };
    answer_ok(outcome)
}

async fn delete_messages(
    State(operation_context): State<OperationContext>,
    body: Bytes,
) -> Response {
    let outcome = match read_json_body::<MailpitMessageIdsBody>(&body) {
        Ok(message_ids) => {
            delete_mailpit_messages(&operation_context, message_ids.message_ids).await
        }
        Err(mailpit_error) => Err(mailpit_error),
    };
    answer_ok(outcome)
}

async fn read_message(
    State(operation_context): State<OperationContext>,
    Path(message_id): Path<String>,
) -> Response {
    answer_json(read_mailpit_message(&operation_context, &message_id).await)
}

async fn read_headers(
    State(operation_context): State<OperationContext>,
    Path(message_id): Path<String>,
) -> Response {
    answer_json(read_mailpit_headers(&operation_context, &message_id).await)
}

async fn read_source(
    State(operation_context): State<OperationContext>,
    Path(message_id): Path<String>,
) -> Response {
    match read_mailpit_source(&operation_context, &message_id).await {
        Ok(source_bytes) => {
            (StatusCode::OK, [(CONTENT_TYPE, PLAIN_TEXT)], source_bytes).into_response()
        }
        Err(mailpit_error) => answer_error(mailpit_error),
    }
}

async fn read_part(
    State(operation_context): State<OperationContext>,
    Path((message_id, part_id)): Path<(String, String)>,
) -> Response {
    match read_mailpit_part(&operation_context, &message_id, &part_id).await {
        Ok((content_type, part_bytes)) => {
            (StatusCode::OK, [(CONTENT_TYPE, content_type)], part_bytes).into_response()
        }
        Err(mailpit_error) => answer_error(mailpit_error),
    }
}

async fn list_tags(State(operation_context): State<OperationContext>) -> Response {
    answer_json(list_mailpit_tags(&operation_context).await)
}

async fn set_tags(State(operation_context): State<OperationContext>, body: Bytes) -> Response {
    let outcome = match read_json_body::<MailpitTagsBody>(&body) {
        Ok(tags_body) => {
            set_mailpit_tags(&operation_context, tags_body.message_ids, tags_body.tags).await
        }
        Err(mailpit_error) => Err(mailpit_error),
    };
    answer_ok(outcome)
}

/// `/view/{ID}.html` and `/view/{ID}.txt`.
async fn read_view(
    State(operation_context): State<OperationContext>,
    Path(view_file): Path<String>,
) -> Response {
    let (message_id, content_type, is_html) =
        if let Some(message_id) = view_file.strip_suffix(".html") {
            (message_id, "text/html; charset=utf-8", true)
        } else if let Some(message_id) = view_file.strip_suffix(".txt") {
            (message_id, PLAIN_TEXT, false)
        } else {
            return plain_text(StatusCode::NOT_FOUND, "not found".to_owned());
        };
    match read_mailpit_view(&operation_context, message_id, is_html).await {
        Ok(part_text) => {
            (StatusCode::OK, [(CONTENT_TYPE, content_type)], part_text).into_response()
        }
        Err(mailpit_error) => answer_error(mailpit_error),
    }
}
