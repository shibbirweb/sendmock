export type ApiMode = "mock" | "live";

/**
 * "mock" answers every API call in the browser (MSW), "live" talks to a running
 * mss server. Mock is the default until the backend exists (Stage B, Phase 1).
 */
export const apiMode: ApiMode =
  import.meta.env.VITE_API_MODE === "live" ? "live" : "mock";
