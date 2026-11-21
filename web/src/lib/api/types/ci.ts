import type { IsoTimestamp } from "@/lib/api/types/common";
import type { ScenarioReport } from "@/lib/api/types/automation";

/** Body of POST /api/v1/ci/run and /ci/validate (WH-15). */
export type CiFileRequest = {
  /**
   * The CI file (`format: sendmock.ci`) in JSON or YAML. A setup or scenario named by a path must be inlined first, as `sendmock ci run` does; URLs are downloaded.
   * @example "sendmock:\n  format: sendmock.ci\n  format_version: 1\nscenarios:\n  - name: health\n    steps:\n      - run: http\n        with: { method: GET, url: /api/v1/health }\n"
   */
  ci_file: string;
};

/** Answer of POST /api/v1/ci/validate. */
export type CiValidation = {
  is_valid: boolean;
  scenario_count: number;
  /** Each problem, with the scenario it is in when there is one. */
  problems: string[];
};

/** Answer of POST /api/v1/ci/run: every scenario's steps, and the reports CI systems read. */
export type CiReport = {
  is_passed: boolean;
  started_at: IsoTimestamp;
  duration_ms: number;
  passed_count: number;
  failed_count: number;
  scenarios: ScenarioReport[];
  /** The JUnit XML report: a test suite per scenario and a test case per step. */
  junit_xml: string;
  /** A Markdown summary, as `GITHUB_STEP_SUMMARY` shows it. */
  summary_markdown: string;
};

/** The CI systems `sendmock ci init` writes a job for. */
export type CiSystem =
  | "github_actions"
  | "gitlab_ci"
  | "circleci"
  | "bitbucket_pipelines"
  | "azure_pipelines"
  | "jenkins";

/** Body of POST /api/v1/ci/init. */
export type CiInitRequest = {
  /**
   * The CI system to write a job for. `sendmock ci init` finds it from the repository.
   * @example "github_actions"
   */
  provider: CiSystem;
  /**
   * Where the pipeline downloads the setup; the written file's path when null.
   * @example null
   */
  setup_url?: string | null;
  /**
   * The app's base URL in the pipeline [default: http://localhost:8000].
   * @example "http://localhost:8000"
   */
  app_url?: string | null;
};

/** One file `sendmock ci init` writes. */
export type CiInitFile = {
  /** Relative to the repository's root. */
  path: string;
  content: string;
  /** What it is and what to do with it. */
  purpose: string;
};

/** Answer of POST /api/v1/ci/init. */
export type CiInitFiles = {
  provider: CiSystem;
  files: CiInitFile[];
};
