export type DiffLine = {
  change: "same" | "added" | "removed";
  lineText: string;
};

/**
 * A line diff from `beforeText` to `afterText` using the longest common
 * subsequence: removed lines come before the added lines that replace them.
 */
export function diffLines(beforeText: string, afterText: string): DiffLine[] {
  const beforeLines = beforeText.split("\n");
  const afterLines = afterText.split("\n");
  const commonLengths = Array.from({ length: beforeLines.length + 1 }, () =>
    new Array<number>(afterLines.length + 1).fill(0),
  );

  for (
    let beforeIndex = beforeLines.length - 1;
    beforeIndex >= 0;
    beforeIndex -= 1
  ) {
    for (
      let afterIndex = afterLines.length - 1;
      afterIndex >= 0;
      afterIndex -= 1
    ) {
      const nextRow = commonLengths[beforeIndex + 1] ?? [];
      const currentRow = commonLengths[beforeIndex] ?? [];
      currentRow[afterIndex] =
        beforeLines[beforeIndex] === afterLines[afterIndex]
          ? (nextRow[afterIndex + 1] ?? 0) + 1
          : Math.max(nextRow[afterIndex] ?? 0, currentRow[afterIndex + 1] ?? 0);
    }
  }

  const diffResult: DiffLine[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  while (beforeIndex < beforeLines.length && afterIndex < afterLines.length) {
    const beforeLine = beforeLines[beforeIndex] ?? "";
    const afterLine = afterLines[afterIndex] ?? "";
    if (beforeLine === afterLine) {
      diffResult.push({ change: "same", lineText: beforeLine });
      beforeIndex += 1;
      afterIndex += 1;
    } else if (
      (commonLengths[beforeIndex + 1]?.[afterIndex] ?? 0) >=
      (commonLengths[beforeIndex]?.[afterIndex + 1] ?? 0)
    ) {
      diffResult.push({ change: "removed", lineText: beforeLine });
      beforeIndex += 1;
    } else {
      diffResult.push({ change: "added", lineText: afterLine });
      afterIndex += 1;
    }
  }
  for (const removedLine of beforeLines.slice(beforeIndex)) {
    diffResult.push({ change: "removed", lineText: removedLine });
  }
  for (const addedLine of afterLines.slice(afterIndex)) {
    diffResult.push({ change: "added", lineText: addedLine });
  }

  return diffResult;
}
