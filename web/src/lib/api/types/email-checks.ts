/** Results of the email quality checks (docs/plan/03-email.md#quality-checks). */

export type HtmlClientSupport = {
  client: string;
  support_percent: number;
};

export type HtmlCheckWarning = {
  feature: string;
  support_percent: number;
  line: number | null;
  note: string;
};

export type HtmlCheckReport = {
  overall_support_percent: number;
  clients: HtmlClientSupport[];
  warnings: HtmlCheckWarning[];
};

export type LinkCheckResult = {
  url: string;
  kind: "link" | "image";
  status_code: number | null;
  redirect_url: string | null;
  duration_ms: number | null;
  error_message: string | null;
};

export type SpamCheckRule = {
  name: string;
  score: number;
  description: string;
};

export type SpamCheckReport = {
  /** False when no SpamAssassin server is configured. */
  is_available: boolean;
  score: number | null;
  threshold: number;
  rules: SpamCheckRule[];
};

export type ListUnsubscribeReport = {
  has_header: boolean;
  values: string[];
  supports_one_click: boolean;
  warnings: string[];
};
