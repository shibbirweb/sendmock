import { expect, test } from "bun:test";
import { ESLint } from "eslint";

const eslint = new ESLint({ cwd: `${import.meta.dir}/../..` });

async function lintComponent(componentSource: string): Promise<string[]> {
  const [lintResult] = await eslint.lintText(componentSource, {
    filePath: "src/features/probe/probe-actions.tsx",
  });

  return (lintResult?.messages ?? []).map((lintMessage) => lintMessage.message);
}

test("UI-13.3 an icon-sized Button outside IconButton fails the lint check", async () => {
  const lintMessages = await lintComponent(
    [
      'import { Button } from "@/components/ui/button";',
      "",
      "export function ProbeActions() {",
      '  return <Button size="icon-sm" aria-label="Delete" />;',
      "}",
      "",
    ].join("\n"),
  );

  expect(lintMessages).toContainEqual(
    expect.stringContaining("Use IconButton"),
  );
});

test("UI-13.3 IconButton with its required label passes the lint check", async () => {
  const lintMessages = await lintComponent(
    [
      'import { IconButton } from "@/components/common/icon-button";',
      "",
      "export function ProbeActions() {",
      '  return <IconButton size="icon-sm" label="Delete" />;',
      "}",
      "",
    ].join("\n"),
  );

  expect(lintMessages).toEqual([]);
});
