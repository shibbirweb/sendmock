import { activityCellPitch, measureActivityGrid } from "./activity-field";

/** A square counts as inside the letters when at least half of it is covered. */
const coveredAlpha = 128;

/**
 * A fast "is this point inside the letters?" test for the grid. Instead of one hit test per
 * square, it paints the letters once into a tiny off-screen canvas with one pixel per square
 * and reads every pixel back in one call. Null when no 2D context is available, so the caller
 * falls back to `isPointInPath`.
 */
export function createLetterMask(
  width: number,
  height: number,
  letterPathData: string,
  pitch = activityCellPitch,
): ((x: number, y: number) => boolean) | null {
  const { columns, rows, offsetX, offsetY } = measureActivityGrid(
    width,
    height,
    pitch,
  );
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = columns;
  maskCanvas.height = rows;
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
  if (!maskContext || columns === 0 || rows === 0) {
    return null;
  }
  maskContext.setTransform(
    1 / pitch,
    0,
    0,
    1 / pitch,
    -offsetX / pitch,
    -offsetY / pitch,
  );
  maskContext.fill(new Path2D(letterPathData), "nonzero");
  const { data: maskPixels } = maskContext.getImageData(0, 0, columns, rows);

  return (x, y) => {
    const column = Math.floor((x - offsetX) / pitch);
    const row = Math.floor((y - offsetY) / pitch);
    if (column < 0 || column >= columns || row < 0 || row >= rows) {
      return false;
    }
    return (maskPixels[(row * columns + column) * 4 + 3] ?? 0) >= coveredAlpha;
  };
}
