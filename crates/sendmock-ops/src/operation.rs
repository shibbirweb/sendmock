use std::future::Future;

use schemars::JsonSchema;
use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::{OperationContext, OperationError, RequestLogSettings};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
}

impl HttpMethod {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Get => "GET",
            Self::Post => "POST",
            Self::Put => "PUT",
            Self::Patch => "PATCH",
            Self::Delete => "DELETE",
        }
    }
}

/// Picks one operation when several share an MCP tool.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OperationSelector {
    pub input_name: &'static str,
    pub choice: SelectorChoice,
}

/// An extra input with a fixed value (`channel=sms`), or whether a real input is given
/// (`number_id` given updates, missing creates).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SelectorChoice {
    Value(&'static str),
    Presence { is_given: bool },
}

impl OperationSelector {
    pub const fn by_value(input_name: &'static str, value: &'static str) -> Self {
        Self {
            input_name,
            choice: SelectorChoice::Value(value),
        }
    }

    pub const fn by_presence(input_name: &'static str, is_given: bool) -> Self {
        Self {
            input_name,
            choice: SelectorChoice::Presence { is_given },
        }
    }
}

/// A `<placeholder>` in a CLI usage and the input it fills; `reads_file` sends the named
/// file's text instead of the path.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CliArgument {
    pub placeholder: &'static str,
    pub input_name: &'static str,
    pub reads_file: bool,
}

/// The HTTP status of a successful answer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SuccessStatus {
    Ok,
    Created,
    /// The answer has no body.
    NoContent,
}

impl SuccessStatus {
    pub fn code(self) -> u16 {
        match self {
            Self::Ok => 200,
            Self::Created => 201,
            Self::NoContent => 204,
        }
    }
}

/// A request body taken as text instead of JSON, and the input field it fills.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RawBodyInput {
    pub input_name: &'static str,
    pub content_type: &'static str,
}

/// What a successful answer carries: JSON, or a file of a content type.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnswerKind {
    Json,
    File { content_type: &'static str },
}

/// What every surface needs to know about an operation, named as in `docs/api/openapi.yaml`
/// and the surface catalogue, so the binary serves exactly the commands and tools documented.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OperationDefinition {
    pub operation_id: &'static str,
    pub method: HttpMethod,
    pub path: &'static str,
    pub summary: &'static str,
    pub is_read_only: bool,
    /// Deletes or overwrites data, so the CLI asks for `--yes` and MCP marks it.
    pub is_destructive: bool,
    /// The CLI command with its positional arguments, e.g. `sendmock seed validate <file>`.
    pub cli_usage: &'static str,
    pub mcp_tool: &'static str,
    pub selector: Option<OperationSelector>,
    pub cli_arguments: &'static [CliArgument],
    /// Flags the naming rules get wrong, by input, e.g. `("timeout", "wait")` for `--wait`.
    pub cli_flag_names: &'static [(&'static str, &'static str)],
    /// A boolean output field that must be true for the CLI to exit 0, such as `is_valid`.
    pub success_flag_field: Option<&'static str>,
    pub success_status: SuccessStatus,
    pub answer_kind: AnswerKind,
    /// Takes the request body as text into an input field, for non-JSON bodies.
    pub raw_body_input: Option<RawBodyInput>,
    /// Records each call in the API request log (native and provider send APIs).
    pub request_log: Option<RequestLogSettings>,
    /// A `GET` path that runs the same operation from the query string, for vendors whose
    /// APIs send that way (`GET /api/v1/sms/send?to=...&body=...`); not in OpenAPI.
    pub get_alias_path: Option<&'static str>,
}

impl OperationDefinition {
    /// The values most operations share; a definition names only what differs.
    pub const DEFAULTS: Self = Self {
        operation_id: "",
        method: HttpMethod::Get,
        path: "",
        summary: "",
        is_read_only: false,
        is_destructive: false,
        cli_usage: "",
        mcp_tool: "",
        selector: None,
        cli_arguments: &[],
        cli_flag_names: &[],
        success_flag_field: None,
        success_status: SuccessStatus::Ok,
        answer_kind: AnswerKind::Json,
        raw_body_input: None,
        request_log: None,
        get_alias_path: None,
    };

    /// Whether the MCP name is a resource (`sendmock://...`) rather than a tool.
    pub fn has_mcp_resource(&self) -> bool {
        self.mcp_tool.starts_with("sendmock://")
    }

    /// The path's `{placeholders}` as input names: `{emailId}` is `email_id`.
    pub fn path_parameter_names(&self) -> Vec<(String, String)> {
        self.path
            .split('/')
            .filter_map(|segment| segment.strip_prefix('{')?.strip_suffix('}'))
            .map(|placeholder| (placeholder.to_owned(), to_snake_case(placeholder)))
            .collect()
    }
}

/// `emailId` to `email_id`; snake_case stays as it is.
pub fn to_snake_case(name: &str) -> String {
    let mut snake_name = String::with_capacity(name.len() + 4);
    let mut previous_character: Option<char> = None;
    for character in name.chars() {
        let follows_lowercase_or_digit = previous_character
            .is_some_and(|previous| previous.is_ascii_lowercase() || previous.is_ascii_digit());
        if character.is_ascii_uppercase() && follows_lowercase_or_digit {
            snake_name.push('_');
        }
        snake_name.push(character.to_ascii_lowercase());
        previous_character = Some(character);
    }
    snake_name
}

/// One feature, defined once: typed input, typed output and the handler (the Command pattern).
pub trait Operation: Send + Sync + 'static {
    type Input: DeserializeOwned + JsonSchema + Send + 'static;
    type Output: Serialize + JsonSchema + Send + 'static;

    fn definition(&self) -> OperationDefinition;

    fn execute(
        &self,
        operation_context: &OperationContext,
        input: Self::Input,
    ) -> impl Future<Output = Result<Self::Output, OperationError>> + Send;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn turns_camel_case_into_snake_case() {
        assert_eq!(to_snake_case("emailId"), "email_id");
        assert_eq!(to_snake_case("attachmentIndex"), "attachment_index");
        assert_eq!(to_snake_case("already_snake"), "already_snake");
    }

    #[test]
    fn reads_the_path_parameters_in_order() {
        let definition = OperationDefinition {
            path: "/api/v1/emails/{emailId}/attachments/{attachmentIndex}",
            ..OperationDefinition::DEFAULTS
        };

        assert_eq!(
            definition.path_parameter_names(),
            [
                ("emailId".to_owned(), "email_id".to_owned()),
                ("attachmentIndex".to_owned(), "attachment_index".to_owned()),
            ]
        );
    }
}
