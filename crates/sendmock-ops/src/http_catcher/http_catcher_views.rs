use sendmock_core::format_rfc3339;
use sendmock_store::{CapturedRequestRecord, HttpBinRecord};

use super::http_bin_presets::plain_default_response;
use super::http_catcher_wire::{CapturedHttpFile, CapturedHttpRequest, HttpBin};

pub fn present_http_bin(bin_record: &HttpBinRecord) -> HttpBin {
    HttpBin {
        id: bin_record.bin_id.clone(),
        name: bin_record.name.clone(),
        preset: bin_record
            .preset
            .as_deref()
            .and_then(|preset| serde_json::from_value(serde_json::Value::from(preset)).ok()),
        request_count: bin_record.request_count,
        last_request_at: bin_record.last_request_at_unix_ms.map(format_rfc3339),
        default_response: serde_json::from_str(&bin_record.default_response_json)
            .unwrap_or_else(|_| plain_default_response()),
    }
}

pub fn present_captured_request(request_record: CapturedRequestRecord) -> CapturedHttpRequest {
    CapturedHttpRequest {
        query: serde_json::from_str(&request_record.query_json).unwrap_or_default(),
        headers: serde_json::from_str(&request_record.headers_json).unwrap_or_default(),
        response_headers: serde_json::from_str(&request_record.response_headers_json)
            .unwrap_or_default(),
        files: request_record
            .files
            .iter()
            .map(|captured_file| CapturedHttpFile {
                file_index: captured_file.file_index,
                field_name: captured_file.field_name.clone(),
                filename: captured_file.filename.clone(),
                content_type: captured_file.content_type.clone(),
                size_bytes: captured_file.size_bytes,
            })
            .collect(),
        created_at: format_rfc3339(request_record.created_at_unix_ms),
        id: request_record.request_id,
        bin_id: request_record.bin_id,
        bin_name: request_record.bin_name,
        method: request_record.method,
        url: request_record.url,
        path: request_record.path,
        body: request_record.body,
        content_type: request_record.content_type,
        client_ip: request_record.client_ip,
        response_status: request_record.response_status,
        response_body: request_record.response_body,
        matched_rule_id: request_record.matched_rule_id,
        matched_rule_name: request_record.matched_rule_name,
        is_simulated_failure: request_record.is_simulated_failure,
        duration_ms: request_record.duration_ms,
    }
}
