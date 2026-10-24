/**
 * Shared shapes of the MessageHook REST API (docs/plan/06-api.md). Field names mirror
 * the JSON wire format (snake_case) so these types are the API contract until
 * it is frozen into docs/api/openapi.yaml.
 */

/** Sortable unique ID (ULID), e.g. "01JB6Z3K8Q2W5X7Y9A1B3C5D7E". */
export type Ulid = string;

/** RFC 3339 UTC timestamp, e.g. "2026-10-24T16:00:00Z". */
export type IsoTimestamp = string;

export type EmailAddress = {
  name: string;
  address: string;
};

export type PageOf<ItemType> = {
  items: ItemType[];
  next_cursor: string | null;
  total_count: number;
};

export type PageRequest = {
  cursor?: string;
  limit?: number;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    field?: string;
  };
};

/** Who created a configuration item; agents get a badge in the UI. */
export type CreatedBy = "ui" | "api" | "cli" | "mcp" | "seed";

export type ExtractedData = {
  otp: string[];
  links: string[];
};

export type OpenSource = "ui" | "manual" | "api";

export type OpenRecord = {
  opened_at: IsoTimestamp;
  source: OpenSource;
  user_agent: string | null;
};
