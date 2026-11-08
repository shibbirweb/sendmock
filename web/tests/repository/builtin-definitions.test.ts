import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { buildBuiltinDefinitionFiles } from "../../scripts/export-builtin-definitions";

test("the binary embeds the same SMS providers and webhook templates the mock ships", () => {
  for (const { filePath, content } of buildBuiltinDefinitionFiles()) {
    expect(readFileSync(filePath, "utf8")).toBe(content);
  }
});
