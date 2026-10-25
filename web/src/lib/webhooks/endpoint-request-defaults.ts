import type { WebhookEndpointInput } from "@/lib/api/types";

/** A new endpoint's request: its template's body, nothing extra, strict rendering. */
export const defaultEndpointRequest: Pick<
  WebhookEndpointInput,
  | "query_params"
  | "body_mode"
  | "body_fields"
  | "fields_encoding"
  | "raw_content_type"
  | "raw_body"
  | "render_mode"
> = {
  query_params: [],
  body_mode: "template",
  body_fields: [],
  fields_encoding: "json",
  raw_content_type: "application/json",
  raw_body: "",
  render_mode: "strict",
};
