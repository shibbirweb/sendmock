/** Distance between neighbouring squares, in the wordmark's drawing units. */
export const activityCellPitch = 1.8;
/** How much of the pitch a square fills; the rest is the gap between squares. */
export const activityCellFill = 0.8;
/** Corner radius as a share of the square's side, as on GitHub's graph. */
export const activityCellCorner = 0.2;
/** Levels run from 0 (no downloads) to `activityLevelCount - 1` (the busiest day). */
export const activityLevelCount = 5;
export const activityFieldSeed = 0x5f3759df;

export type ActivityCell = {
  x: number;
  y: number;
};

export type ActivityGridLayout = {
  columns: number;
  rows: number;
  offsetX: number;
  offsetY: number;
};

/** A small seeded random source (mulberry32), so the same data always draws the same graph. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How a grid of `pitch` squares fits a `width` x `height` box: whole columns and rows, centred.
 * The square list and the letter mask share it, so a mask pixel always lines up with its square.
 */
export function measureActivityGrid(
  width: number,
  height: number,
  pitch = activityCellPitch,
): ActivityGridLayout {
  const columns = Math.floor(width / pitch);
  const rows = Math.floor(height / pitch);
  return {
    columns,
    rows,
    offsetX: (width - columns * pitch) / 2,
    offsetY: (height - rows * pitch) / 2,
  };
}

/** The grid squares whose centre `isInsideLetters` accepts, so the squares spell the word. */
export function listActivityCells(
  width: number,
  height: number,
  isInsideLetters: (x: number, y: number) => boolean,
  pitch = activityCellPitch,
): ActivityCell[] {
  const cells: ActivityCell[] = [];
  const { columns, rows, offsetX, offsetY } = measureActivityGrid(
    width,
    height,
    pitch,
  );
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = offsetX + column * pitch;
      const y = offsetY + row * pitch;
      if (isInsideLetters(x + pitch / 2, y + pitch / 2)) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

/**
 * Each square's neighbours (up to eight). A square's antialiased edge can share a device pixel
 * with a neighbour's, so repainting one square exactly means repainting those neighbours too.
 */
export function listCellNeighbours(
  cells: readonly ActivityCell[],
  pitch = activityCellPitch,
): number[][] {
  const indexByPosition = new Map<string, number>();
  const findGridPosition = (cell: ActivityCell) => [
    Math.round(cell.x / pitch),
    Math.round(cell.y / pitch),
  ];
  cells.forEach((cell, cellIndex) => {
    const [column, row] = findGridPosition(cell);
    indexByPosition.set(`${column},${row}`, cellIndex);
  });
  return cells.map((cell) => {
    const [column, row] = findGridPosition(cell);
    const neighbourIndices: number[] = [];
    for (let rowStep = -1; rowStep <= 1; rowStep++) {
      for (let columnStep = -1; columnStep <= 1; columnStep++) {
        const neighbourIndex = indexByPosition.get(
          `${(column ?? 0) + columnStep},${(row ?? 0) + rowStep}`,
        );
        const isSelf = rowStep === 0 && columnStep === 0;
        if (!isSelf && neighbourIndex !== undefined) {
          neighbourIndices.push(neighbourIndex);
        }
      }
    }
    return neighbourIndices;
  });
}

/** How far a lit square's shade swells above and below its level while it breathes. */
export const breathAmplitude = 0.4;
/** How far a day with no downloads glows while lit; below the lowest a level 1 day dips. */
export const emptyDayGlow = 0.45;

/**
 * The level a square shows while breathing: its resting `level` nudged by `wave` (-1 to 1)
 * scaled by `envelope` (0 at rest, 1 fully lit). An empty day only glows faintly upward, so
 * it never reads as a day with downloads.
 */
export function breatheLevel(
  level: number,
  wave: number,
  envelope: number,
): number {
  if (level <= 0) {
    return envelope * emptyDayGlow * (0.5 + 0.5 * wave);
  }
  const breathingLevel = level + wave * envelope * breathAmplitude;
  return Math.min(Math.max(breathingLevel, 0), activityLevelCount - 1);
}
