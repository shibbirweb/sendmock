import type { CreatedBy, Ulid } from "@/lib/api/types/common";

export type VariableKind =
  | "text"
  | "number"
  | "boolean"
  | "json"
  | "secret"
  | "dynamic"
  | "random"
  | "computed"
  | "prompt";

export type WebhookVariable = {
  id: Ulid;
  /**
   * The name templates read it by, as `{{ vars.<name> }}`.
   * @example "tenant_id"
   */
  name: string;
  /**
   * `text`, `number`, `boolean`, `json` and `secret` are fixed values; `dynamic` is read from the event, `random` is generated, `computed` combines other variables and `prompt` is asked for on manual sends.
   * @example "text"
   */
  kind: VariableKind;
  /**
   * `global` for every endpoint, or `endpoint` for one; endpoint values win.
   * @example "global"
   */
  scope: "global" | "endpoint";
  /**
   * The endpoint of an `endpoint` variable; null for global ones.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  endpoint_id: Ulid | null;
  /**
   * Static value, expression, generator or default; secrets are masked.
   * @example "acme"
   */
  value: string;
  /**
   * For `random`: `per_send` generates a new value each time, `fixed` keeps one value until Regenerate; null for other kinds.
   * @example "per_send"
   */
  random_mode: "per_send" | "fixed" | null;
  /** The generated value of a Fixed random variable; Regenerate replaces it (WH-07.13). */
  fixed_value: string | null;
  /**
   * What the variable is for.
   * @example "Tenant every webhook is sent for"
   */
  description: string;
  created_by: CreatedBy;
};

/** Body of POST /api/v1/webhooks/variables/preview (WH-07.12). */
export type VariablePreviewRequest = {
  /**
   * The variable kind, as in a variable.
   * @example "random"
   */
  kind: VariableKind;
  /**
   * The value, expression or generator to try.
   * @example "random_string(16)"
   */
  value: string;
};

export type VariablePreviewResult = {
  resolved_value: string;
  warnings: string[];
  errors: string[];
};

/** Body of POST and PATCH /api/v1/webhooks/variables. */
export type WebhookVariableInput = Pick<
  WebhookVariable,
  | "name"
  | "kind"
  | "scope"
  | "endpoint_id"
  | "value"
  | "random_mode"
  | "description"
>;
