/** A name for captured traffic: the emails, SMS and verifications sent to it (PL-10). */
export type Project = {
  /**
   * What apps send as the SMTP username, the `X-SendMock-Project` header or the
   * `/projects/<key>/` URL prefix. It never changes.
   * @example "shop"
   */
  key: string;
  /**
   * A name for the project, shown in the UI.
   * @example "Shop"
   */
  name: string;
  /** @example "2026-11-07T10:00:00Z" */
  created_at: string;
  /** @example 12 */
  email_count: number;
  /** @example 4 */
  sms_count: number;
  /** @example 2 */
  verification_count: number;
};

/** Body of POST /api/v1/projects. */
export type ProjectInput = Pick<Project, "key" | "name">;

/** Body of PATCH /api/v1/projects/{projectKey}: the new name. */
export type ProjectUpdate = Pick<Project, "name">;
