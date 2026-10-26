import type { IsoTimestamp, Ulid } from "@/lib/api/types/common";
import type { AppEventType } from "@/lib/api/types/events";
import type {
  HttpMethod,
  RenderProblem,
} from "@/lib/api/types/webhook-endpoints";

export type TemplateCategory =
  | "email-provider"
  | "sms-provider"
  | "chat"
  | "automation"
  | "generic"
  | "custom";

export type WebhookTemplateSummary = {
  id: string;
  /**
   * The template's name.
   * @example "Order webhook"
   */
  name: string;
  service: string;
  category: TemplateCategory;
  source: "builtin" | "custom" | "file";
  /**
   * The event types the template is made for.
   * @example ["email.received"]
   */
  events: AppEventType[];
  /**
   * What the template sends and where.
   * @example "Posts each received email to the orders app."
   */
  description: string;
  /**
   * Variables an endpoint must define to use it.
   * @example ["app_token"]
   */
  required_variables: string[];
  revision: number;
  /** A built-in template the user edited; Reset to default restores it (WH-09.8). */
  is_modified: boolean;
};

/** The editable part of a template; body of PATCH /api/v1/webhooks/templates/{templateId}. */
export type TemplateDraft = {
  /**
   * The HTTP method.
   * @example "POST"
   */
  method: HttpMethod;
  /**
   * The body's content type.
   * @example "application/json"
   */
  content_type: string;
  /**
   * Header name to a template, e.g. "X-Twilio-Signature": "{{ twilio_signature(...) }}".
   * @example {"Authorization": "Bearer {{ vars.app_token }}"}
   */
  header_templates: Record<string, string>;
  /**
   * The body, a template over the event, its data and the variables.
   * @example "{\"subject\": \"{{ data.subject }}\"}"
   */
  body_template: string;
};

/** GET /api/v1/webhooks/templates/{templateId} (WH-08.4). */
export type WebhookTemplateDetail = WebhookTemplateSummary &
  TemplateDraft & {
    doc_url: string | null;
    /** "2026-09-30": when a provider template was last checked against the docs. */
    verified_on: string | null;
    used_by_endpoint_count: number;
  };

/** Template details only custom templates can change (WH-09.9). */
export type TemplateMetadata = Pick<
  WebhookTemplateSummary,
  "name" | "description" | "events" | "required_variables"
>;

/** Body of PATCH /api/v1/webhooks/templates/{templateId}; metadata is ignored for built-ins. */
export type TemplateUpdate = TemplateDraft & Partial<TemplateMetadata>;

/** One saved version of a template (WH-09.5). */
export type TemplateRevision = {
  revision: number;
  saved_at: IsoTimestamp;
  template: TemplateDraft & TemplateMetadata;
};

export type TemplateValueType =
  "string" | "number" | "boolean" | "timestamp" | "object" | "list";

/** One value a template can read, e.g. `data.to[0].address` (WH-07.9). */
export type TemplateReferenceField = {
  path: string;
  /** The last part of the path, shown in the tree. */
  name: string;
  value_type: TemplateValueType;
  description: string;
  /** From the preview sample; secrets come masked. */
  example: string | null;
  children: TemplateReferenceField[];
};

/** A function or filter, with how to call it. */
export type TemplateReferenceHelper = {
  name: string;
  signature: string;
  description: string;
  example: string;
};

/** GET /api/v1/webhooks/template-reference?events=... */
export type TemplateReference = {
  fields: TemplateReferenceField[];
  functions: TemplateReferenceHelper[];
  filters: TemplateReferenceHelper[];
};

/** Body of POST /api/v1/webhooks/templates (a new blank custom template). */
export type TemplateCreateRequest = {
  /**
   * The name of the new blank custom template.
   * @example "Order webhook"
   */
  name: string;
};

/** Body of POST /api/v1/webhooks/templates/import (WH-09.3). */
export type TemplateImportRequest = {
  /**
   * The template file's text, TOML or JSON as exported.
   * @example "id = \"custom.order_webhook\"\nname = \"Order webhook\""
   */
  file_text: string;
  /**
   * What to do when the id is taken; left out, the API answers 409.
   * @example "copy"
   */
  on_conflict?: "replace" | "copy";
};

/** Body of POST /api/v1/webhooks/templates/{templateId}/render; empty for the sample. */
export type TemplateRenderRequest = {
  /**
   * Render against this email; with no IDs the sample event is used.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  email_id?: Ulid;
  /**
   * Render against this SMS.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  sms_id?: Ulid;
  /**
   * A captured HTTP request, as the data of an `http.captured` event.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  http_request_id?: Ulid;
  /**
   * Unsaved edits to preview instead of the stored template (WH-09.7).
   */
  draft?: TemplateDraft;
};

export type TemplateRenderResult = {
  /** What it was rendered against, e.g. "Built-in sample" or an email subject. */
  rendered_against: string;
  headers: Record<string, string>;
  body: string;
  /** Undefined variables; they render empty. */
  warnings: string[];
  /** Problems that stop the template from being saved: unknown functions or filters, unbalanced braces. */
  errors: string[];
  /** The same problems with where they are, for markers in the code editor. */
  problems: RenderProblem[];
};

/** Body of POST /api/v1/webhooks/templates/{templateId}/clone. */
export type TemplateCloneRequest = {
  /**
   * The name of the copy.
   * @example "Slack alerts (team)"
   */
  name: string;
};
