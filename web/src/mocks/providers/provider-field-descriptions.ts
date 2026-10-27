/** What each value a provider template can read means, by path (EM-18.4, SM-16.4). */
export const providerFieldDescriptions: Record<string, string> = {
  request: "The request your app sent to the provider's path.",
  "request.method": "The HTTP method, e.g. POST.",
  "request.path": "The path as your app called it.",
  "request.path_params":
    "The values of the path's {name} parts, e.g. domain or AccountSid.",
  "request.headers": "The request headers, by lowercase name.",
  "request.body": "The parsed body: JSON, or the fields of a form or query.",
  message: "The message SendMock stores for the request.",
  "message.id": "SendMock's own id (a ULID).",
  "message.provider_id": "The provider's id, from the Message id template.",
  "message.from": "The sender, read through the field mapping.",
  "message.to": "The recipients, comma-separated.",
  "message.subject": "The email subject; empty for SMS.",
  "message.body": "The text body (email text or the SMS body).",
  "message.status": "SendMock's status, e.g. queued.",
  error: "Why the request was refused, in error responses.",
  "error.kind":
    "missing_field, invalid_value, unauthorized, not_found or rate_limited.",
  "error.part": "The message part that failed, e.g. to.",
  "error.reason": "A sentence that explains the failure.",
  credentials:
    "The provider's credentials by name; secrets are masked in previews.",
};
