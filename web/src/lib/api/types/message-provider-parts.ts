/**
 * The parts of an email or SMS provider definition
 * (docs/plan/22-configurable-providers.md, EM-18 and SM-16).
 */

/** Whether a provider sends email or SMS. */
export type MessageProviderArea = "email" | "sms";

/** The email requests SendMock knows how to run (a new kind needs code). */
export type EmailProviderOperationKind =
  "send" | "send_batch" | "send_with_template" | "fetch";

/** The SMS requests SendMock knows how to run (a new kind needs code). */
export type SmsProviderOperationKind =
  | "send"
  | "fetch"
  | "list"
  | "cancel"
  | "start_verification"
  | "check_verification";

export type ProviderOperationKind =
  EmailProviderOperationKind | SmsProviderOperationKind;

/** A part of a message a request can carry; email and SMS use their own parts. */
export type ProviderMessagePart =
  | "from"
  | "to"
  | "cc"
  | "bcc"
  | "reply_to"
  | "subject"
  | "text"
  | "html"
  | "attachments"
  | "headers"
  | "tags"
  | "template_id"
  | "template_data"
  | "body"
  | "media_urls"
  | "messaging_service"
  | "status_callback_url";

/** The kinds of error a provider answers with its own shape. */
export type ProviderErrorKind =
  | "missing_field"
  | "invalid_value"
  | "unauthorized"
  | "not_found"
  | "rate_limited";

/** A credential your app is configured with; a secret's value comes back masked (`••••` and the last 4). */
export type ProviderCredential = {
  /**
   * The credential's name, readable in templates as `credentials.<name>`.
   * @example "api_key"
   */
  name: string;
  /**
   * The value; a secret comes back masked, and sending the masked value back keeps the stored one.
   * @example "SG.test_key_123"
   */
  value: string;
  /**
   * Masks the value in the UI, API answers, logs and MCP output.
   * @example true
   */
  is_secret: boolean;
};

/** One request the provider answers. */
export type ProviderOperation = {
  /**
   * What the request does, from the kinds SendMock can run.
   * @example "send"
   */
  kind: ProviderOperationKind;
  /**
   * The HTTP method.
   * @example "POST"
   */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /**
   * The path at the provider's API, with `{name}` for variable parts.
   * @example "/v3/{domain}/messages"
   */
  path: string;
  /**
   * How the request body is sent: `json`, `form`, `multipart`, or `query` for none.
   * @example "multipart"
   */
  request_format: "json" | "form" | "multipart" | "query";
};

/** Where one part of a sent message is read from in the request. */
export type ProviderFieldMapping = {
  /**
   * The part of the message.
   * @example "to"
   */
  part: ProviderMessagePart;
  /**
   * The request path it is read from: a JSON path, a form field or a query parameter.
   * @example "personalizations[0].to[*].email"
   */
  source: string;
};

/** A check on a request, and the error it answers when the check fails. */
export type ProviderValidationRule = {
  /**
   * The part of the message checked.
   * @example "to"
   */
  part: ProviderMessagePart;
  /**
   * The check: present, an email address, an E.164 number, or at most `max_length` characters.
   * @example "required"
   */
  check: "required" | "email_address" | "e164_number" | "max_length";
  /**
   * The longest value allowed, for `max_length`; null otherwise.
   * @example null
   */
  max_length: number | null;
  /**
   * The error answered when the check fails.
   * @example "missing_field"
   */
  error_kind: ProviderErrorKind;
};

/** A response header, from a template. */
export type ProviderHeaderTemplate = {
  /**
   * The header name.
   * @example "X-Message-Id"
   */
  name: string;
  /**
   * The value, a template over the message and the request.
   * @example "{{ message.provider_id }}"
   */
  template: string;
};

/** What the provider answers: a status, headers and a body template. */
export type ProviderResponseTemplate = {
  /**
   * The HTTP status code.
   * @example 202
   */
  status: number;
  /**
   * Headers sent with the response.
   */
  headers: ProviderHeaderTemplate[];
  /**
   * The body, a template over the message, the request and the error.
   * @example "{\"id\": \"{{ message.provider_id }}\"}"
   */
  body: string;
};

/** The answer for one kind of error. */
export type ProviderErrorResponse = ProviderResponseTemplate & {
  /**
   * The kind of error this response answers.
   * @example "missing_field"
   */
  kind: ProviderErrorKind;
};

/** One template or definition problem, named by the part it is in, e.g. `Success response body`. */
export type ProviderDefinitionProblem = {
  part: string;
  message: string;
  severity: "error" | "warning";
};
