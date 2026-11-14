import { tmpdir } from "node:os";
import { join } from "node:path";

/** Where build-feature-issues.ts writes the issues the other roadmap scripts read. */
export const generatedIssuesPath = join(
  tmpdir(),
  "sendmock-roadmap-issues.json",
);
