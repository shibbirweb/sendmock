import { readFileSync } from "node:fs";
import { join } from "node:path";

// Written once at export time into out/openapi.yaml, the same contract the reference reads (PL-01.5).
export const dynamic = "force-static";

export function GET() {
  const openApiYaml = readFileSync(
    join(process.cwd(), "..", "docs", "api", "openapi.yaml"),
    "utf8",
  );

  return new Response(openApiYaml, {
    headers: { "Content-Type": "application/yaml; charset=utf-8" },
  });
}
