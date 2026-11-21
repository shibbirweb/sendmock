import { buildShadeColors, findShadeIndex } from "./activity-colors";
import {
  type ActivityCell,
  activityCellCorner,
  activityCellFill,
  activityCellPitch,
  activityLevelCount,
} from "./activity-field";

export type GraphCanvas = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  viewBoxWidth: number;
  viewBoxHeight: number;
};

const squareSize = activityCellPitch * activityCellFill;
const cornerRadius = squareSize * activityCellCorner;
/** Half the gap on each side, so every square sits centred in its cell. */
const squareInset = (activityCellPitch - squareSize) / 2;

/**
 * The level colours from the canvas's `--download-level-<n>` custom properties, expanded into
 * every in-between shade. Read again after a theme change.
 */
export function readShadeColors(canvas: HTMLCanvasElement): string[] {
  const canvasStyle = getComputedStyle(canvas);
  const levelColors = Array.from({ length: activityLevelCount }, (_, level) =>
    canvasStyle.getPropertyValue(`--download-level-${level}`).trim(),
  );
  return buildShadeColors(levelColors);
}

/** Stretches the drawing units over the canvas's pixels, so the squares line up with the letters. */
function scaleToViewBox({
  canvas,
  context,
  viewBoxWidth,
  viewBoxHeight,
}: GraphCanvas) {
  context.setTransform(
    canvas.width / viewBoxWidth,
    0,
    0,
    canvas.height / viewBoxHeight,
    0,
    0,
  );
}

/** Fills the given squares grouped by shade, so each colour is filled once. */
function fillSquares(
  context: CanvasRenderingContext2D,
  cells: readonly ActivityCell[],
  cellIndices: Iterable<number>,
  displayedLevels: ArrayLike<number>,
  shadeColors: readonly string[],
) {
  const cellsByShade: ActivityCell[][] = shadeColors.map(() => []);
  for (const cellIndex of cellIndices) {
    const cell = cells[cellIndex];
    if (cell) {
      cellsByShade[findShadeIndex(displayedLevels[cellIndex] ?? 0)]?.push(cell);
    }
  }
  cellsByShade.forEach((shadeCells, shadeIndex) => {
    if (shadeCells.length === 0) {
      return;
    }
    context.beginPath();
    for (const cell of shadeCells) {
      context.roundRect(
        cell.x + squareInset,
        cell.y + squareInset,
        squareSize,
        squareSize,
        cornerRadius,
      );
    }
    context.fillStyle = shadeColors[shadeIndex] ?? "";
    context.fill();
  });
}

/** Paints every square in the shade of its displayed level: the first paint, a resize, a theme. */
export function drawActivityGraph(
  graphCanvas: GraphCanvas,
  cells: readonly ActivityCell[],
  displayedLevels: ArrayLike<number>,
  shadeColors: readonly string[],
) {
  scaleToViewBox(graphCanvas);
  graphCanvas.context.clearRect(
    0,
    0,
    graphCanvas.viewBoxWidth,
    graphCanvas.viewBoxHeight,
  );
  fillSquares(
    graphCanvas.context,
    cells,
    cells.keys(),
    displayedLevels,
    shadeColors,
  );
}

type PixelBox = { left: number; top: number; right: number; bottom: number };

function measureSquarePixels(
  cell: ActivityCell,
  scaleX: number,
  scaleY: number,
): PixelBox {
  return {
    left: Math.floor((cell.x + squareInset) * scaleX),
    top: Math.floor((cell.y + squareInset) * scaleY),
    right: Math.ceil((cell.x + squareInset + squareSize) * scaleX),
    bottom: Math.ceil((cell.y + squareInset + squareSize) * scaleY),
  };
}

function doBoxesOverlap(firstBox: PixelBox, secondBox: PixelBox): boolean {
  return (
    firstBox.left < secondBox.right &&
    secondBox.left < firstBox.right &&
    firstBox.top < secondBox.bottom &&
    secondBox.top < firstBox.bottom
  );
}

/**
 * Repaints only the changed squares, pixel for pixel as a full repaint would leave them: it
 * clips to each changed square's whole device pixels, clears them, and refills the changed
 * squares plus any neighbour reaching into the same pixels. While the graph breathes, far
 * fewer squares change shade per frame than exist.
 */
export function drawChangedSquares(
  graphCanvas: GraphCanvas,
  cells: readonly ActivityCell[],
  cellNeighbours: readonly (readonly number[])[],
  changedCellIndices: readonly number[],
  displayedLevels: ArrayLike<number>,
  shadeColors: readonly string[],
) {
  const { canvas, context } = graphCanvas;
  const scaleX = canvas.width / graphCanvas.viewBoxWidth;
  const scaleY = canvas.height / graphCanvas.viewBoxHeight;
  const repaintedCellIndices = new Set<number>();

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.beginPath();
  for (const cellIndex of changedCellIndices) {
    const cell = cells[cellIndex];
    if (!cell) {
      continue;
    }
    const squareBox = measureSquarePixels(cell, scaleX, scaleY);
    context.rect(
      squareBox.left,
      squareBox.top,
      squareBox.right - squareBox.left,
      squareBox.bottom - squareBox.top,
    );
    repaintedCellIndices.add(cellIndex);
    for (const neighbourIndex of cellNeighbours[cellIndex] ?? []) {
      const neighbour = cells[neighbourIndex];
      if (
        neighbour &&
        !repaintedCellIndices.has(neighbourIndex) &&
        doBoxesOverlap(
          squareBox,
          measureSquarePixels(neighbour, scaleX, scaleY),
        )
      ) {
        repaintedCellIndices.add(neighbourIndex);
      }
    }
  }
  context.clip();
  context.clearRect(0, 0, canvas.width, canvas.height);
  scaleToViewBox(graphCanvas);
  fillSquares(
    context,
    cells,
    repaintedCellIndices,
    displayedLevels,
    shadeColors,
  );
  context.restore();
}
