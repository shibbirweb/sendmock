use std::collections::BTreeMap;

use serde_json::{Map, Value, json};

use crate::payments::{PaymentDetail, PaymentGatewayFields, read_payment_document};
use crate::providers::ProviderHttpRequest;
use crate::{OperationContext, OperationError};

/// What the custom gateway API answers: a status, a content type and the body text.
pub struct CustomGatewayAnswer {
    pub status: u16,
    pub content_type: String,
    pub body: String,
}

impl CustomGatewayAnswer {
    pub fn json(status: u16, body: &Value) -> Self {
        Self {
            status,
            content_type: "application/json".to_owned(),
            body: body.to_string(),
        }
    }
}

/// A refusal in the custom gateway API's error shape.
pub struct CustomGatewayRefusal {
    pub status: u16,
    pub code: &'static str,
    pub message: String,
    pub field: Option<String>,
}

impl CustomGatewayRefusal {
    pub fn invalid_field(field_name: &str, message: String) -> Self {
        Self {
            status: 400,
            code: "invalid_request",
            message,
            field: Some(field_name.to_owned()),
        }
    }

    pub fn to_answer(&self) -> CustomGatewayAnswer {
        CustomGatewayAnswer::json(
            self.status,
            &json!({
                "error": {
                    "code": self.code,
                    "message": self.message,
                    "field": self.field,
                },
            }),
        )
    }
}

fn read_form_fields(form_bytes: &[u8]) -> Map<String, Value> {
    serde_urlencoded::from_bytes::<Vec<(String, String)>>(form_bytes)
        .unwrap_or_default()
        .into_iter()
        .map(|(field_name, field_value)| (field_name, Value::from(field_value)))
        .collect()
}

fn is_json_request(request: &ProviderHttpRequest) -> bool {
    request
        .header("content-type")
        .is_some_and(|content_type| content_type.contains("json"))
        || request.body.trim_ascii_start().starts_with(b"{")
}

/// The query's fields, then the body's (a JSON object or a form), which win on a clash.
fn read_request_fields(
    request: &ProviderHttpRequest,
) -> Result<Map<String, Value>, CustomGatewayRefusal> {
    let mut request_fields = read_form_fields(
        request
            .query_string
            .as_deref()
            .unwrap_or_default()
            .as_bytes(),
    );
    if request.body.is_empty() {
        return Ok(request_fields);
    }
    if is_json_request(request) {
        let Ok(Value::Object(body_fields)) = serde_json::from_slice::<Value>(&request.body) else {
            return Err(CustomGatewayRefusal::invalid_field(
                "body",
                "The body must be a JSON object".to_owned(),
            ));
        };
        request_fields.extend(body_fields);
    } else {
        request_fields.extend(read_form_fields(&request.body));
    }
    Ok(request_fields)
}

fn to_field_text(field_value: &Value) -> Option<String> {
    let field_text = match field_value {
        Value::String(text) => text.trim().to_owned(),
        Value::Number(number) => number.to_string(),
        Value::Bool(flag) => flag.to_string(),
        _ => return None,
    };
    Some(field_text).filter(|field_text| !field_text.is_empty())
}

/// One request to a custom gateway's API.
pub struct CustomGatewayCall<'call> {
    pub operation_context: &'call OperationContext,
    pub gateway_fields: &'call PaymentGatewayFields,
    request: &'call ProviderHttpRequest,
    request_fields: Map<String, Value>,
}

impl<'call> CustomGatewayCall<'call> {
    pub fn new(
        operation_context: &'call OperationContext,
        gateway_fields: &'call PaymentGatewayFields,
        request: &'call ProviderHttpRequest,
    ) -> Result<Self, CustomGatewayRefusal> {
        Ok(Self {
            operation_context,
            gateway_fields,
            request,
            request_fields: read_request_fields(request)?,
        })
    }

    /// The field as text, none when it is missing, blank or not a single value.
    pub fn read_text(&self, field_name: &str) -> Option<String> {
        self.request_fields.get(field_name).and_then(to_field_text)
    }

    /// `metadata` as a JSON object, or `metadata[key]` form fields.
    pub fn read_metadata(&self) -> BTreeMap<String, String> {
        if let Some(Value::Object(metadata_fields)) = self.request_fields.get("metadata") {
            return metadata_fields
                .iter()
                .filter_map(|(metadata_key, metadata_value)| {
                    to_field_text(metadata_value).map(|text| (metadata_key.clone(), text))
                })
                .collect();
        }
        self.request_fields
            .iter()
            .filter_map(|(field_name, field_value)| {
                let metadata_key = field_name.strip_prefix("metadata[")?.strip_suffix(']')?;
                to_field_text(field_value).map(|text| (metadata_key.to_owned(), text))
            })
            .collect()
    }

    /// The first credential the request names with another value, as a field or a header.
    pub fn find_wrong_credential(&self) -> Option<&str> {
        self.gateway_fields
            .credentials
            .iter()
            .filter(|credential| !credential.name.trim().is_empty())
            .find(|credential| {
                let sent_value = self
                    .read_text(&credential.name)
                    .or_else(|| self.request.header(&credential.name).map(str::to_owned));
                sent_value.is_some_and(|sent_value| sent_value != credential.value)
            })
            .map(|credential| credential.name.as_str())
    }

    /// This gateway's payment with the id or the `reference`, the newest when several are.
    pub async fn find_payment(
        &self,
        payment_reference: &str,
    ) -> Result<Option<PaymentDetail>, OperationError> {
        let payment_repository = &self.operation_context.payment_repository;
        let stored_payment = match payment_repository.find_payment(payment_reference).await? {
            Some(stored_payment) => Some(stored_payment),
            None => {
                payment_repository
                    .find_payment_by_provider_id(&self.gateway_fields.key, payment_reference)
                    .await?
            }
        };
        let payment = stored_payment
            .map(|stored_payment| read_payment_document(&stored_payment))
            .transpose()?;
        Ok(payment.filter(|payment| {
            payment.summary.provider == self.gateway_fields.key
                && (payment.summary.id == payment_reference
                    || payment.provider_ids.get("reference").map(String::as_str)
                        == Some(payment_reference))
        }))
    }
}
