//! The Cloud API's media endpoints: upload (`POST /{version}/{phone_number_id}/media`), look up
//! and delete (`GET` and `DELETE /{version}/{media_id}`), and the download URL the lookup names.

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use sendmock_store::WhatsappMediaRecord;
use serde_json::json;
use sha2::{Digest, Sha256};

use super::provider_form_fields::{read_provider_form_fields, read_provider_form_files};
use super::provider_http::{ProviderHttpRequest, ProviderHttpResponse};
use super::twilio_answers::answer_json;
use super::whatsapp_graph_errors::{answer_graph_error, answer_invalid_parameter};
use crate::sms::InlineSmsMedia;
use crate::{OperationContext, OperationError, ProviderRoute};

/// Meta's download links are on `lookaside.fbsbx.com/whatsapp_business/attachments/?mid=...`;
/// SendMock answers the same path on the provider's own address.
pub const MEDIA_DOWNLOAD_PATH: &str = "/whatsapp_business/attachments/";

fn answer_missing_media(
    operation_context: &OperationContext,
    media_id: &str,
) -> ProviderHttpResponse {
    let message = format!(
        "Unsupported get request. Object with ID '{media_id}' does not exist, cannot be loaded due to missing permissions, or does not support this operation."
    );
    answer_graph_error(operation_context, 400, 100, &message, &message)
}

/// Meta's media ids are numbers of 15 or 16 digits.
fn generate_media_id(operation_context: &OperationContext) -> String {
    let random_number = operation_context.random_source.next_u64() % 9_000_000_000_000_000;
    (1_000_000_000_000_000 + random_number).to_string()
}

/// Stores the multipart `file` and answers its new id.
pub async fn answer_media_upload(
    operation_context: &OperationContext,
    phone_number_id: &str,
    request: &ProviderHttpRequest,
) -> Result<ProviderHttpResponse, OperationError> {
    let form_fields = read_provider_form_fields(request);
    let read_field = |field_name: &str| {
        form_fields
            .iter()
            .find(|(name, _)| name == field_name)
            .map(|(_, value)| value.clone())
    };
    if read_field("messaging_product").as_deref() != Some("whatsapp") {
        let reason = "The parameter messaging_product is required.";
        return Ok(answer_invalid_parameter(operation_context, reason));
    }
    let Some(uploaded_file) = read_provider_form_files(request)
        .into_iter()
        .find(|form_part| form_part.field_name == "file")
    else {
        return Ok(answer_invalid_parameter(
            operation_context,
            "The parameter file is required.",
        ));
    };
    let mime_type = read_field("type")
        .or(uploaded_file.content_type.clone())
        .unwrap_or_else(|| "application/octet-stream".to_owned());
    let media_id = generate_media_id(operation_context);
    let media = WhatsappMediaRecord {
        media_id: media_id.clone(),
        phone_number_id: phone_number_id.to_owned(),
        mime_type,
        file_name: uploaded_file.file_name,
        sha256: Sha256::digest(&uploaded_file.content)
            .iter()
            .map(|digest_byte| format!("{digest_byte:02x}"))
            .collect(),
        content: uploaded_file.content,
        project_key: operation_context.request.project_key.clone(),
        created_at_unix_ms: operation_context.clock.now_unix_ms(),
    };
    operation_context
        .sms_repository
        .whatsapp_media()
        .insert_media(media)
        .await?;
    Ok(answer_json(200, json!({ "id": media_id })))
}

/// Where the download link points: the provider port, or `/providers/whatsapp_cloud` on the
/// main port, at the host the app called.
fn build_download_url(
    request: &ProviderHttpRequest,
    provider_route: ProviderRoute<'_>,
    media_id: &str,
) -> String {
    let host = request.header("host").unwrap_or("127.0.0.1");
    let route_prefix = match provider_route {
        ProviderRoute::Prefixed(provider_key) => format!("/providers/{provider_key}"),
        ProviderRoute::ProviderPort => String::new(),
    };
    format!("http://{host}{route_prefix}{MEDIA_DOWNLOAD_PATH}?mid={media_id}")
}

/// The media's details and download link, as Meta answers them.
pub async fn answer_media_lookup(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
    media_id: &str,
) -> Result<ProviderHttpResponse, OperationError> {
    let found_media = operation_context
        .sms_repository
        .whatsapp_media()
        .find_media(media_id)
        .await?;
    let Some(media) = found_media else {
        return Ok(answer_missing_media(operation_context, media_id));
    };
    Ok(answer_json(
        200,
        json!({
            "messaging_product": "whatsapp",
            "url": build_download_url(request, provider_route, media_id),
            "mime_type": media.mime_type,
            "sha256": media.sha256,
            "file_size": media.content.len(),
            "id": media.media_id,
        }),
    ))
}

pub async fn answer_media_delete(
    operation_context: &OperationContext,
    media_id: &str,
) -> Result<ProviderHttpResponse, OperationError> {
    let is_deleted = operation_context
        .sms_repository
        .whatsapp_media()
        .delete_media(media_id)
        .await?;
    if !is_deleted {
        return Ok(answer_missing_media(operation_context, media_id));
    }
    Ok(answer_json(200, json!({ "success": true })))
}

/// The uploaded files a message names by id, ready to attach; unknown ids are left out, as Meta
/// only finds them missing later.
pub async fn load_media_by_ids(
    operation_context: &OperationContext,
    media_ids: &[String],
) -> Result<Vec<InlineSmsMedia>, OperationError> {
    let media_repository = operation_context.sms_repository.whatsapp_media();
    let mut attached_media = Vec::new();
    for media_id in media_ids {
        if let Some(media) = media_repository.find_media(media_id).await? {
            attached_media.push(InlineSmsMedia {
                filename: media.file_name,
                content: BASE64.encode(&media.content),
                content_type: Some(media.mime_type),
            });
        }
    }
    Ok(attached_media)
}

/// A download link's file: its type and bytes, or `None` when the path is not a download or
/// the media is gone. Answered outside the text-only provider answers, since media is binary.
pub async fn find_whatsapp_media_download(
    operation_context: &OperationContext,
    request: &ProviderHttpRequest,
) -> Result<Option<(String, Vec<u8>)>, OperationError> {
    if request.method != "GET" || request.path != MEDIA_DOWNLOAD_PATH {
        return Ok(None);
    }
    let media_id = request
        .query_string
        .as_deref()
        .unwrap_or_default()
        .split('&')
        .find_map(|query_pair| query_pair.strip_prefix("mid="));
    let Some(media_id) = media_id else {
        return Ok(None);
    };
    let found_media = operation_context
        .sms_repository
        .whatsapp_media()
        .find_media(media_id)
        .await?;
    Ok(found_media.map(|media| (media.mime_type, media.content)))
}
