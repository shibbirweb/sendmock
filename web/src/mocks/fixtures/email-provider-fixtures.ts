import {
  answerError,
  buildProviderFixture,
  checkEmailAddresses,
  type MessageProviderRecord,
  requireParts,
  respondWithJson,
} from "@/mocks/fixtures/message-provider-builder";

const emailStatusNames = {
  delivered: "delivered",
  bounced: "bounce",
  complained: "spamreport",
  opened: "open",
};

function buildSendgridProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "sendgrid",
    name: "SendGrid",
    area: "email",
    accent: "#1a82e2",
    host: "api.sendgrid.com",
    credentials: [
      { name: "api_key", value: "SG.test_key_123", is_secret: true },
    ],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/v3/mail/send",
        request_format: "json",
      },
    ],
    field_mapping: [
      { part: "from", source: "from.email" },
      { part: "to", source: "personalizations[*].to[*].email" },
      { part: "cc", source: "personalizations[*].cc[*].email" },
      { part: "subject", source: "subject" },
      { part: "text", source: "content[type=text/plain].value" },
      { part: "html", source: "content[type=text/html].value" },
      { part: "attachments", source: "attachments" },
      { part: "template_id", source: "template_id" },
      {
        part: "template_data",
        source: "personalizations[0].dynamic_template_data",
      },
    ],
    validation_rules: [
      ...requireParts(["from", "to"]),
      ...checkEmailAddresses(["from", "to"]),
    ],
    success_response: {
      status: 202,
      headers: [
        { name: "X-Message-Id", template: "{{ message.provider_id }}" },
      ],
      body: "",
    },
    error_responses: [
      answerError(
        "missing_field",
        400,
        '{"errors": [{"message": "The {{ error.part }} field is required.", "field": "{{ error.part }}", "help": null}]}',
      ),
      answerError(
        "invalid_value",
        400,
        '{"errors": [{"message": "Does not contain a valid address.", "field": "{{ error.part }}", "help": null}]}',
      ),
      answerError(
        "unauthorized",
        401,
        '{"errors": [{"message": "The provided authorization grant is invalid, expired, or revoked", "field": null, "help": null}]}',
      ),
    ],
    message_id_template: "{{ random_hex(22) }}",
    callback_template_key: "sendgrid.events",
    status_names: emailStatusNames,
  });
}

function buildMailgunProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "mailgun",
    name: "Mailgun",
    area: "email",
    accent: "#f06b66",
    host: "api.mailgun.net",
    credentials: [{ name: "api_key", value: "key-test123", is_secret: true }],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/v3/{domain}/messages",
        request_format: "multipart",
      },
    ],
    field_mapping: [
      { part: "from", source: "from" },
      { part: "to", source: "to" },
      { part: "cc", source: "cc" },
      { part: "subject", source: "subject" },
      { part: "text", source: "text" },
      { part: "html", source: "html" },
      { part: "attachments", source: "attachment" },
      { part: "tags", source: "o:tag" },
      { part: "headers", source: "h:*" },
    ],
    validation_rules: requireParts(["from", "to"]),
    success_response: respondWithJson(
      200,
      '{"id": "{{ message.provider_id }}", "message": "Queued. Thank you."}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        400,
        '{"message": "\'{{ error.part }}\' parameter is missing"}',
      ),
      answerError("unauthorized", 401, '{"message": "Forbidden"}'),
    ],
    message_id_template:
      "<{{ now_unix() }}.{{ random_hex(16) }}@{{ request.path_params.domain }}>",
    callback_template_key: null,
    status_names: {
      delivered: "delivered",
      bounced: "failed",
      complained: "complained",
      opened: "opened",
    },
  });
}

function buildPostmarkProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "postmark",
    name: "Postmark",
    area: "email",
    accent: "#ffde00",
    host: "api.postmarkapp.com",
    credentials: [
      { name: "server_token", value: "pm-test-token", is_secret: true },
    ],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/email",
        request_format: "json",
      },
      {
        kind: "send_batch",
        method: "POST",
        path: "/email/batch",
        request_format: "json",
      },
      {
        kind: "send_with_template",
        method: "POST",
        path: "/email/withTemplate",
        request_format: "json",
      },
    ],
    field_mapping: [
      { part: "from", source: "From" },
      { part: "to", source: "To" },
      { part: "cc", source: "Cc" },
      { part: "bcc", source: "Bcc" },
      { part: "subject", source: "Subject" },
      { part: "text", source: "TextBody" },
      { part: "html", source: "HtmlBody" },
      { part: "attachments", source: "Attachments" },
      { part: "tags", source: "Tag" },
      { part: "template_id", source: "TemplateId" },
      { part: "template_data", source: "TemplateModel" },
    ],
    validation_rules: requireParts(["from", "to"]),
    success_response: respondWithJson(
      200,
      '{"To": "{{ message.to }}", "SubmittedAt": "{{ now_iso() }}", "MessageID": "{{ message.provider_id }}", "ErrorCode": 0, "Message": "OK"}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        422,
        '{"ErrorCode": 300, "Message": "Invalid email request"}',
      ),
      answerError(
        "unauthorized",
        401,
        '{"ErrorCode": 10, "Message": "No Account or Server API tokens were supplied in the HTTP headers."}',
      ),
    ],
    message_id_template: "{{ uuid() }}",
    callback_template_key: null,
    status_names: {
      delivered: "Delivery",
      bounced: "Bounce",
      complained: "SpamComplaint",
      opened: "Open",
    },
  });
}

function buildResendProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "resend",
    name: "Resend",
    area: "email",
    accent: "#000000",
    host: "api.resend.com",
    credentials: [{ name: "api_key", value: "re_test_123", is_secret: true }],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/emails",
        request_format: "json",
      },
      {
        kind: "send_batch",
        method: "POST",
        path: "/emails/batch",
        request_format: "json",
      },
      {
        kind: "fetch",
        method: "GET",
        path: "/emails/{id}",
        request_format: "query",
      },
    ],
    field_mapping: [
      { part: "from", source: "from" },
      { part: "to", source: "to" },
      { part: "cc", source: "cc" },
      { part: "bcc", source: "bcc" },
      { part: "reply_to", source: "reply_to" },
      { part: "subject", source: "subject" },
      { part: "text", source: "text" },
      { part: "html", source: "html" },
      { part: "attachments", source: "attachments" },
      { part: "tags", source: "tags" },
    ],
    validation_rules: requireParts(["from", "to", "subject"]),
    success_response: respondWithJson(
      200,
      '{"id": "{{ message.provider_id }}"}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        422,
        '{"statusCode": 422, "message": "Missing `{{ error.part }}` field.", "name": "missing_required_field"}',
      ),
      answerError(
        "unauthorized",
        401,
        '{"statusCode": 401, "message": "Missing API key in the authorization header.", "name": "missing_api_key"}',
      ),
      answerError(
        "not_found",
        404,
        '{"statusCode": 404, "message": "Email not found", "name": "not_found"}',
      ),
    ],
    message_id_template: "{{ uuid() }}",
    callback_template_key: "resend.events",
    status_names: {
      delivered: "email.delivered",
      bounced: "email.bounced",
      complained: "email.complained",
      opened: "email.opened",
    },
  });
}

function buildSesProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "ses",
    name: "Amazon SES",
    area: "email",
    accent: "#ff9900",
    host: "email.us-east-1.amazonaws.com",
    credentials: [
      { name: "access_key_id", value: "AKIATEST123", is_secret: false },
      {
        name: "secret_access_key",
        value: "ses-test-secret",
        is_secret: true,
      },
    ],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/v2/email/outbound-emails",
        request_format: "json",
      },
    ],
    field_mapping: [
      { part: "from", source: "FromEmailAddress" },
      { part: "to", source: "Destination.ToAddresses" },
      { part: "cc", source: "Destination.CcAddresses" },
      { part: "bcc", source: "Destination.BccAddresses" },
      { part: "reply_to", source: "ReplyToAddresses" },
      { part: "subject", source: "Content.Simple.Subject.Data" },
      { part: "text", source: "Content.Simple.Body.Text.Data" },
      { part: "html", source: "Content.Simple.Body.Html.Data" },
    ],
    validation_rules: requireParts(["from", "to"]),
    success_response: respondWithJson(
      200,
      '{"MessageId": "{{ message.provider_id }}"}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        400,
        '{"message": "Missing required field {{ error.part }}"}',
      ),
      answerError(
        "unauthorized",
        403,
        '{"message": "The security token included in the request is invalid."}',
      ),
    ],
    message_id_template: "0100{{ random_hex(12) }}-{{ uuid() }}-000000",
    callback_template_key: "ses.sns",
    status_names: {
      delivered: "Delivery",
      bounced: "Bounce",
      complained: "Complaint",
      opened: "Open",
    },
  });
}

function buildBrevoProvider(): MessageProviderRecord {
  return buildProviderFixture({
    key: "brevo",
    name: "Brevo",
    area: "email",
    accent: "#0b996e",
    host: "api.brevo.com",
    credentials: [
      { name: "api_key", value: "xkeysib-test123", is_secret: true },
    ],
    operations: [
      {
        kind: "send",
        method: "POST",
        path: "/v3/smtp/email",
        request_format: "json",
      },
    ],
    field_mapping: [
      { part: "from", source: "sender.email" },
      { part: "to", source: "to[*].email" },
      { part: "cc", source: "cc[*].email" },
      { part: "bcc", source: "bcc[*].email" },
      { part: "reply_to", source: "replyTo.email" },
      { part: "subject", source: "subject" },
      { part: "text", source: "textContent" },
      { part: "html", source: "htmlContent" },
      { part: "attachments", source: "attachment" },
      { part: "tags", source: "tags" },
      { part: "template_id", source: "templateId" },
      { part: "template_data", source: "params" },
    ],
    validation_rules: requireParts(["from", "to"]),
    success_response: respondWithJson(
      201,
      '{"messageId": "{{ message.provider_id }}"}',
    ),
    error_responses: [
      answerError(
        "missing_field",
        400,
        '{"code": "missing_parameter", "message": "{{ error.part }} is missing"}',
      ),
      answerError(
        "unauthorized",
        401,
        '{"code": "unauthorized", "message": "Key not found"}',
      ),
    ],
    message_id_template: "<{{ random_hex(24) }}@smtp-relay.mailin.fr>",
    callback_template_key: null,
    status_names: {
      delivered: "delivered",
      bounced: "hard_bounce",
      complained: "spam",
      opened: "opened",
    },
  });
}

/** The email providers SendMock ships (docs/plan/22-configurable-providers.md, 03-email.md). */
export function buildBuiltinEmailProviders(): MessageProviderRecord[] {
  return [
    buildSendgridProvider(),
    buildMailgunProvider(),
    buildPostmarkProvider(),
    buildResendProvider(),
    buildSesProvider(),
    buildBrevoProvider(),
  ];
}
