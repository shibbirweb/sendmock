import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { wordmarkPathData } from "../../website/components/footer-wordmark/sendmock-wordmark-path";
import {
  flattenWordmarkPath,
  outlineRustFilePath,
  renderOutlineRustSource,
} from "./export-wordmark-outline";

describe("the startup banner's wordmark outline", () => {
  test("PL-23.6 the outline in the binary is the one the website footer draws", () => {
    const freshSource = renderOutlineRustSource(flattenWordmarkPath(wordmarkPathData));
    const committedSource = readFileSync(outlineRustFilePath, "utf8").replaceAll("\r\n", "\n");

    // When this fails, run `bun scripts/banner/export-wordmark-outline.ts` and commit the file.
    expect(committedSource).toBe(freshSource);
  });

  test("a curve becomes six straight edges that end on its end point", () => {
    const contours = flattenWordmarkPath("M 0 0 Q 10 0 10 10 Z");

    expect(contours).toHaveLength(1);
    expect(contours[0]).toHaveLength(7);
    expect(contours[0]?.[6]).toEqual([10, 10]);
  });

  test("one shape per M, so letters and their holes stay apart", () => {
    const contours = flattenWordmarkPath("M 0 0 L 4 0 L 4 4 Z M 1 1 L 3 1 L 3 3 Z");

    expect(contours).toEqual([
      [
        [0, 0],
        [4, 0],
        [4, 4],
      ],
      [
        [1, 1],
        [3, 1],
        [3, 3],
      ],
    ]);
  });

  test("a command it cannot read stops the export instead of drawing a wrong outline", () => {
    expect(() => flattenWordmarkPath("M 0 0 C 1 1 2 2 3 3 Z")).toThrow("only absolute M, L, Q and Z");
  });
});
