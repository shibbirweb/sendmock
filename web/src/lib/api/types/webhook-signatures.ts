/** How a webhook is signed (WH-15.5). */
export type SignatureSchemeName = "standard_webhooks" | "stripe" | "hmac";

/** Body of POST /api/v1/webhooks/signatures/verify. */
export type SignatureVerifyRequest = {
  /**
   * `standard_webhooks`, `stripe` or `hmac`.
   * @example "standard_webhooks"
   */
  scheme: SignatureSchemeName;
  /**
   * The signing secret the app checks with; never logged.
   * @example "whsec_c2VuZG1vY2stdGVzdC1rZXktMDAwMQ=="
   */
  secret: string;
  /**
   * A captured request's ID, from an HTTP Catcher bin; or give `headers` and `body`.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  request_id?: string | null;
  headers?: Record<string, string>;
  body?: string | null;
  /**
   * For `hmac`: the header holding the digest [default: X-Signature].
   * @example "X-Hub-Signature-256"
   */
  header?: string | null;
  /**
   * For `hmac`: `hex` or `base64` [default: hex].
   * @example "hex"
   */
  encoding?: "hex" | "base64";
  /**
   * For `hmac`: text before the digest, such as `sha256=` [default: none].
   * @example "sha256="
   */
  prefix?: string | null;
  /**
   * How far a signed timestamp may be from now, in seconds [default: 300].
   * @example 300
   */
  tolerance_seconds?: number | null;
};

/** Answer of POST /api/v1/webhooks/signatures/verify. */
export type SignatureVerification = {
  is_valid: boolean;
  scheme: SignatureSchemeName;
  /** Why it does not check out; null when it does. */
  reason: string | null;
};
