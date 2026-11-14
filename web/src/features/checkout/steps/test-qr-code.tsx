const moduleCount = 21;
const finderSize = 7;

/** A small deterministic hash, so the same session always draws the same code. */
function hashText(seedText: string): number {
  return [...seedText].reduce(
    (runningHash, character) =>
      (Math.imul(runningHash, 31) + character.charCodeAt(0)) >>> 0,
    2166136261,
  );
}

function isInFinder(rowIndex: number, columnIndex: number): boolean {
  const isNearStart = (position: number) => position < finderSize;
  const isNearEnd = (position: number) => position >= moduleCount - finderSize;

  return (
    (isNearStart(rowIndex) && isNearStart(columnIndex)) ||
    (isNearStart(rowIndex) && isNearEnd(columnIndex)) ||
    (isNearEnd(rowIndex) && isNearStart(columnIndex))
  );
}

function isFinderModuleDark(rowIndex: number, columnIndex: number): boolean {
  const localRow = rowIndex % (moduleCount - finderSize);
  const localColumn = columnIndex % (moduleCount - finderSize);
  const ringDistance = Math.max(
    Math.abs(localRow - 3),
    Math.abs(localColumn - 3),
  );

  return ringDistance !== 2;
}

/**
 * A QR-like picture for the test checkout (PY-12.6). It is not a real QR code:
 * nothing is encoded, so scanning it does nothing; "I have paid" finishes the
 * test payment. Drawn in SVG so no QR library is needed.
 */
export function TestQrCode({
  seedText,
  label,
}: {
  seedText: string;
  label: string;
}) {
  let patternState = hashText(seedText);
  const darkModules: { rowIndex: number; columnIndex: number }[] = [];
  for (let rowIndex = 0; rowIndex < moduleCount; rowIndex++) {
    for (let columnIndex = 0; columnIndex < moduleCount; columnIndex++) {
      patternState = (Math.imul(patternState, 1103515245) + 12345) >>> 0;
      const isDark = isInFinder(rowIndex, columnIndex)
        ? isFinderModuleDark(rowIndex, columnIndex)
        : (patternState >>> 16) % 2 === 0;
      if (isDark) {
        darkModules.push({ rowIndex, columnIndex });
      }
    }
  }

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`-2 -2 ${moduleCount + 4} ${moduleCount + 4}`}
      className="size-40 rounded-md border bg-background text-foreground"
    >
      {darkModules.map(({ rowIndex, columnIndex }) => (
        <rect
          key={`${rowIndex}-${columnIndex}`}
          x={columnIndex}
          y={rowIndex}
          width={1}
          height={1}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
