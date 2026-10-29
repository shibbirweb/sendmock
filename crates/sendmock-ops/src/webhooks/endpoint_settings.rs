use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "UPPERCASE")]
pub enum WebhookHttpMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
}

/// `linked` follows template updates, `detached` keeps its own copy.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum TemplateMode {
    Linked,
    Detached,
}

/// How an endpoint builds its body (WH-07.14).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum EndpointBodyMode {
    Template,
    Fields,
    Raw,
    None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum BodyFieldType {
    Text,
    Number,
    Boolean,
    Json,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum FieldsEncoding {
    Json,
    Form,
}

/// `strict` stops a delivery on an undefined variable, `lenient` renders it empty with a warning.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum RenderMode {
    Strict,
    Lenient,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct RetryPolicy {
    /// Attempts in total, the first one included.
    pub max_attempts: u32,
    /// Seconds to wait before each retry, in order; the last value repeats.
    pub backoff_seconds: Vec<u32>,
    /// Also retry on 4xx answers; 5xx, timeouts and connection errors are always retried.
    pub retry_on_client_errors: bool,
}

/// A query param or header: a name and a template value.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct NameValueTemplate {
    /// The query parameter or header name.
    pub name: String,
    /// The value, a template that can use the event and variables.
    pub value: String,
}

/// One Fields-mode row; the value is a template, encoded as its type.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct EndpointBodyField {
    /// The field name; dots make nested keys (`user.email`).
    pub name: String,
    /// How the rendered value is encoded: `text`, `number`, `boolean` or `json`.
    pub value_type: BodyFieldType,
    /// The value, a template that can use the event and variables.
    pub value: String,
}

/// How the endpoint builds each request, stored as one JSON document with the endpoint.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct EndpointRequestSettings {
    /// The HTTP method of each delivery.
    pub method: WebhookHttpMethod,
    /// Extra headers layered on top of the template's.
    pub headers: BTreeMap<String, String>,
    /// Extra body fields layered on top of the template's.
    pub extra_fields: BTreeMap<String, String>,
    /// The payload template, e.g. `native` (Standard Webhooks JSON) or `slack.incoming_webhook`.
    pub template_id: String,
    /// `linked` follows template updates, `detached` keeps its own copy.
    pub template_mode: TemplateMode,
    /// How long to wait for your app's answer, in milliseconds (1000 to 60000).
    pub timeout_ms: u32,
    /// When and how often failed deliveries are retried.
    pub retry_policy: RetryPolicy,
    /// Query parameters added to the URL.
    pub query_params: Vec<NameValueTemplate>,
    /// How the body is built: `template`, `fields`, `raw` or `none`.
    pub body_mode: EndpointBodyMode,
    /// The rows of `fields` mode.
    pub body_fields: Vec<EndpointBodyField>,
    /// How `fields` mode is sent: `json` or `form` (`x-www-form-urlencoded`).
    pub fields_encoding: FieldsEncoding,
    /// The content type of `raw` mode.
    pub raw_content_type: String,
    /// The body template of `raw` mode.
    pub raw_body: String,
    /// `strict` or `lenient` rendering of undefined variables.
    pub render_mode: RenderMode,
}
