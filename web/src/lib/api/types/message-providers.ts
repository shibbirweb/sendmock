import type {
  MessageProviderArea,
  ProviderCredential,
  ProviderDefinitionProblem,
  ProviderErrorResponse,
  ProviderFieldMapping,
  ProviderOperation,
  ProviderOperationKind,
  ProviderResponseTemplate,
  ProviderValidationRule,
} from "@/lib/api/types/message-provider-parts";
import type { TemplateReference } from "@/lib/api/types/webhooks";

/**
 * An email or SMS provider SendMock answers like the real one (EM-18, SM-16):
 * a built-in or one you added, editable like a payment gateway.
 */
export type MessageProviderDefinition = {
  /**
   * The `/providers/<key>/...` path and the `provider` value stored on each message; lowercase, fixed after creation.
   * @example "sendgrid"
   */
  key: string;
  /**
   * The provider's name, shown on messages and in pickers.
   * @example "SendGrid"
   */
  name: string;
  /**
   * Whether it sends email or SMS.
   * @example "email"
   */
  area: MessageProviderArea;
  /**
   * `#rrggbb`, used on its badge.
   * @example "#1a82e2"
   */
  accent: string;
  /**
   * Off providers answer nothing; their paths get SendMock's native 404.
   * @example true
   */
  is_enabled: boolean;
  /**
   * The provider's API host, used on the provider port to tell apart providers that share a path; null when not needed.
   * @example "api.sendgrid.com"
   */
  host: string | null;
  /**
   * The credentials your app is configured with.
   */
  credentials: ProviderCredential[];
  /**
   * Off by default: any credentials are accepted. On: wrong ones get the provider's `unauthorized` answer.
   * @example false
   */
  check_credentials: boolean;
  /**
   * The requests it answers.
   */
  operations: ProviderOperation[];
  /**
   * Where each part of a sent message is read from; anything else is kept as metadata.
   */
  field_mapping: ProviderFieldMapping[];
  /**
   * The checks run on each send, in order.
   */
  validation_rules: ProviderValidationRule[];
  /**
   * The answer to a request that passes every check.
   */
  success_response: ProviderResponseTemplate;
  /**
   * The answer for each kind of error.
   */
  error_responses: ProviderErrorResponse[];
  /**
   * The provider's id for each message, a template.
   * @example "<{{ uuid() }}@sendmock.local>"
   */
  message_id_template: string;
  /**
   * The webhook template its status callbacks and inbound messages are sent with; null sends none.
   * @example "sendgrid-event"
   */
  callback_template_key: string | null;
  /**
   * The provider's name for each SendMock status.
   * @example {"delivered": "delivered", "bounced": "bounce", "complained": "spamreport"}
   */
  status_names: Record<string, string>;
  /**
   * SMS only: the provider's error code for each delivery outcome, so test numbers fail with its own codes.
   * @example {"invalid_number": "21211", "unreachable": "30003"}
   */
  outcome_error_codes: Record<string, string>;
  /** Shipped with SendMock; it can be reset, removed and restored, not deleted. */
  is_builtin: boolean;
  /** A built-in that differs from its shipped default. */
  is_modified: boolean;
  /** A built-in taken out of routing, pickers and snippets; Restore brings it back. */
  is_removed: boolean;
  /** Messages it caught in the last 24 hours. */
  message_count_24h: number;
};

/** Body of PATCH .../providers/{providerKey}; the key and area are fixed. */
export type MessageProviderInput = Omit<
  MessageProviderDefinition,
  "area" | "is_builtin" | "is_modified" | "is_removed" | "message_count_24h"
>;

/** Body of POST /api/v1/emails/providers and /api/v1/sms/providers. */
export type MessageProviderCreateRequest = {
  /**
   * The new provider's name.
   * @example "SSL Wireless"
   */
  name: string;
  /**
   * Its key in `/providers/<key>/...` paths and on messages; lowercase, fixed after creation.
   * @example "sslwireless"
   */
  key: string;
  /**
   * A provider of the same area to copy, or null to start blank.
   * @example "twilio"
   */
  start_from: string | null;
};

/** A request to run through a provider in the preview. */
export type ProviderSampleRequest = {
  /**
   * The HTTP method.
   * @example "POST"
   */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /**
   * The path as your app would call it.
   * @example "/v3/mail/send"
   */
  path: string;
  /**
   * The request headers.
   * @example {"content-type": "application/json", "authorization": "Bearer SG.test_key_123"}
   */
  headers: Record<string, string>;
  /**
   * The raw request body.
   * @example "{\"personalizations\": [{\"to\": [{\"email\": \"ana@example.test\"}]}], \"from\": {\"email\": \"app@example.test\"}, \"subject\": \"Welcome\", \"content\": [{\"type\": \"text/plain\", \"value\": \"Hi\"}]}"
   */
  body: string;
};

/** Body of POST .../providers/{providerKey}/preview (EM-18.4, SM-16.4). */
export type MessageProviderPreviewRequest = {
  /**
   * The provider settings to run, saved or not.
   */
  provider: MessageProviderInput;
  /**
   * The request to run; the provider's example send when left out.
   */
  sample_request?: ProviderSampleRequest;
};

/** What a sample request becomes: the message SendMock would store and the answer it would give. */
export type MessageProviderPreview = {
  /** The operation the request matched, or null when none matched. */
  operation_kind: ProviderOperationKind | null;
  /** The message SendMock would store; null when the request is refused. */
  stored_message: {
    from: string;
    to: string[];
    subject: string | null;
    body: string;
    metadata: Record<string, string>;
  } | null;
  response: { status: number; headers: Record<string, string>; body: string };
  problems: ProviderDefinitionProblem[];
  /** What templates can read, for `{{` suggestions. */
  reference: TemplateReference;
};

/** GET .../providers/{providerKey}/credentials/{credentialName}. */
export type ProviderCredentialReveal = { name: string; value: string };
