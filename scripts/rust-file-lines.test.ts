import { describe, expect, test } from "bun:test";

import {
  classifyFileLineCounts,
  countProductionLines,
  readWorkspaceFileLineCounts,
} from "./rust-file-lines";

describe("countProductionLines", () => {
  test("counts every line of a file without tests", () => {
    expect(countProductionLines("use std::fmt;\n\npub struct Email;\n")).toBe(
      3,
    );
  });

  test("stops at the unit test module", () => {
    const rustSource = [
      "pub fn send() {}",
      "",
      "#[cfg(test)]",
      "mod tests {",
      "    #[test]",
      "    fn sends() {}",
      "}",
    ].join("\n");

    expect(countProductionLines(rustSource)).toBe(1);
  });
});

describe("classifyFileLineCounts", () => {
  test("separates files over the soft and the hard limit", () => {
    const result = classifyFileLineCounts([
      { filePath: "small.rs", productionLines: 120 },
      { filePath: "large.rs", productionLines: 340 },
      { filePath: "too_large.rs", productionLines: 501 },
    ]);

    expect(result.filesOverSoftLimit.map((file) => file.filePath)).toEqual([
      "large.rs",
    ]);
    expect(result.filesOverHardLimit.map((file) => file.filePath)).toEqual([
      "too_large.rs",
    ]);
  });
});

describe("the workspace", () => {
  test("no Rust source file is over the hard limit", () => {
    const { filesOverHardLimit } = classifyFileLineCounts(
      readWorkspaceFileLineCounts(),
    );

    expect(filesOverHardLimit).toEqual([]);
  });
});
