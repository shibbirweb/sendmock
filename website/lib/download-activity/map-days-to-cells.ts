import {
  type ActivityCell,
  activityFieldSeed,
  createSeededRandom,
} from "./activity-field";

/** How far each side of a border between two days blends into the next, as a share of a day. */
export const dayEdgeSoftness = 0.3;
/** A random nudge to each square's position, in days, so a blended border feathers. */
export const dayEdgeJitter = 0.12;
/** The most a square is randomly dimmed, so a busy day reads as texture, not a flat block. */
export const dayTextureDepth = 0.3;

function smoothstep(edgeStart: number, edgeEnd: number, value: number): number {
  const progress = Math.min(
    Math.max((value - edgeStart) / (edgeEnd - edgeStart), 0),
    1,
  );
  return progress * progress * (3 - 2 * progress);
}

/**
 * Gives every square a level from the day under it. The days split the word's width into
 * equal bands, oldest on the left, so reading "SendMock" reads the week. Near each border the
 * level eases into the next day's, and every square is dimmed a little for texture. Seeded,
 * so the same days always draw the same graph. Levels may be fractional.
 */
export function mapDaysToCells(
  cells: readonly ActivityCell[],
  dayLevels: readonly number[],
  seed = activityFieldSeed,
): number[] {
  const cellLevels = new Array<number>(cells.length).fill(0);
  if (dayLevels.length === 0 || cells.length === 0) {
    return cellLevels;
  }
  const random = createSeededRandom(seed);
  const leftX = Math.min(...cells.map((cell) => cell.x));
  const rightX = Math.max(...cells.map((cell) => cell.x));
  const width = rightX - leftX || 1;
  const lastDayIndex = dayLevels.length - 1;
  const findDayLevel = (dayIndex: number) =>
    dayLevels[Math.min(Math.max(dayIndex, 0), lastDayIndex)] ?? 0;

  cells.forEach((cell, cellIndex) => {
    // Day centres sit on whole numbers: 0.5 is the border between day 0 and day 1.
    const jitter = (random() * 2 - 1) * dayEdgeJitter;
    const dayPosition =
      ((cell.x - leftX) / width) * dayLevels.length - 0.5 + jitter;
    const earlierDayIndex = Math.floor(dayPosition);
    const blend = smoothstep(
      0.5 - dayEdgeSoftness,
      0.5 + dayEdgeSoftness,
      dayPosition - earlierDayIndex,
    );
    const earlierLevel = findDayLevel(earlierDayIndex);
    const blendedLevel =
      earlierLevel + (findDayLevel(earlierDayIndex + 1) - earlierLevel) * blend;
    cellLevels[cellIndex] = blendedLevel * (1 - random() * dayTextureDepth);
  });
  return cellLevels;
}
