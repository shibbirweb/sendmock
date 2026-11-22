/** What `POST /api/v1/reset` takes and answers (PL-26.3). */

/** Body of `POST /api/v1/reset`; with no body, a reset that keeps the configuration (PL-26.3). */
export type ResetRequest = {
  /**
   * Also remove every configured item, put the settings and providers back to
   * what SendMock ships with, and forget the seed.
   */
  config?: boolean;
  /** With `config`: how many configured items the reset said it would remove. */
  confirm_removed_count?: number | null;
};

/** How many items of one kind, such as `Webhook endpoint` or `emails`. */
export type ResetItemCount = {
  kind: string;
  count: number;
};

/** What a reset did (PL-26.3). */
export type ResetSummary = {
  /** Traffic deleted, by kind; kinds with nothing to delete are left out. */
  cleared: ResetItemCount[];
  /** Configured items removed by a `config` reset, by kind; empty otherwise. */
  removed: ResetItemCount[];
  /** Configured items that stayed, by kind. */
  kept: ResetItemCount[];
  /** True when the seed applied last was applied again. */
  restored_seed: boolean;
};
