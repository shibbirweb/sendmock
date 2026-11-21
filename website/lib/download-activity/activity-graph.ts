import { findShadeIndex } from "./activity-colors";
import {
  type ActivityCell,
  activityFieldSeed,
  breatheLevel,
  createSeededRandom,
  listActivityCells,
  listCellNeighbours,
} from "./activity-field";
import {
  drawActivityGraph,
  drawChangedSquares,
  type GraphCanvas,
  readShadeColors,
} from "./draw-activity-graph";
import { easeToward } from "./ease-toward";
import { createLetterMask } from "./letter-mask";
import { mapDaysToCells } from "./map-days-to-cells";
import { observeGraphSurroundings } from "./observe-graph-surroundings";

export type ActivityGraphOptions = {
  canvas: HTMLCanvasElement;
  /** Where the pointer spotlight writes `--spotlight-opacity`. */
  spotlight: HTMLElement;
  letterPathData: string;
  viewBoxWidth: number;
  viewBoxHeight: number;
  dayLevels: readonly number[];
};

/** How gently the graph settles onto new days (the live numbers replacing the build's). */
const levelFadeMs = 650;
const levelSettleDistance = 0.02;
/** Each lit square breathes on its own slow cycle in this range, so they never pulse in step. */
const breathPeriodMinMs = 2600;
const breathPeriodMaxMs = 4200;
/** How quickly breathing swells in when the spotlight lights and dies away when it goes dark. */
const breathEnvelopeMs = 500;
const breathEnvelopeSettle = 0.002;
/** Past this share of changed squares in one frame, one full repaint is cheaper. */
const fullRepaintShare = 0.5;
const longestFrameMs = 100;

/**
 * Draws the download days as squares inside the letters on `canvas`, oldest day on the left.
 * New days fade in. While the spotlight is lit the squares breathe around their level; the
 * frame loop stops as soon as nothing moves. Reduced motion and touch screens get a still
 * graph. The canvas carries `data-square-count`, and `data-breathing` while the squares breathe.
 */
export class ActivityGraph {
  private readonly graphCanvas: GraphCanvas;
  private readonly cells: ActivityCell[];
  private readonly cellNeighbours: number[][];
  private readonly targetLevels: Float32Array;
  private readonly restingLevels: Float32Array;
  private readonly shownLevels: Float32Array;
  private readonly lastShades: Int16Array;
  private readonly breathPhases: Float32Array;
  private readonly breathPeriodsMs: Float32Array;
  private readonly shouldBreathe: boolean;
  private readonly levelFadeMs: number;
  private shadeColors: string[];
  private breathEnvelope = 0;
  private frameId = 0;
  private lastFrameMs = 0;
  private readonly stopObservers: () => void;

  static start(options: ActivityGraphOptions): ActivityGraph | null {
    const context = options.canvas.getContext("2d");
    return context ? new ActivityGraph(options, context) : null;
  }

  private constructor(
    private readonly options: ActivityGraphOptions,
    context: CanvasRenderingContext2D,
  ) {
    const { canvas, letterPathData, viewBoxWidth, viewBoxHeight } = options;
    this.graphCanvas = { canvas, context, viewBoxWidth, viewBoxHeight };
    const letters = new Path2D(letterPathData);
    const isInsideLetters =
      createLetterMask(viewBoxWidth, viewBoxHeight, letterPathData) ??
      ((x: number, y: number) =>
        context.isPointInPath(letters, x, y, "nonzero"));
    this.cells = listActivityCells(
      viewBoxWidth,
      viewBoxHeight,
      isInsideLetters,
    );
    this.cellNeighbours = listCellNeighbours(this.cells);

    const shouldReduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    this.shouldBreathe =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !shouldReduceMotion;
    this.levelFadeMs = shouldReduceMotion ? 0 : levelFadeMs;

    this.targetLevels = Float32Array.from(
      mapDaysToCells(this.cells, options.dayLevels),
    );
    this.restingLevels = Float32Array.from(this.targetLevels);
    this.shownLevels = Float32Array.from(this.targetLevels);
    this.lastShades = new Int16Array(this.cells.length).fill(-1);
    const breathRandom = createSeededRandom(activityFieldSeed + 1);
    this.breathPhases = Float32Array.from(
      this.cells,
      () => breathRandom() * Math.PI * 2,
    );
    this.breathPeriodsMs = Float32Array.from(
      this.cells,
      () =>
        breathPeriodMinMs +
        breathRandom() * (breathPeriodMaxMs - breathPeriodMinMs),
    );
    this.shadeColors = readShadeColors(canvas);
    canvas.dataset.squareCount = String(this.cells.length);
    this.stopObservers = observeGraphSurroundings({
      canvas,
      spotlight: options.spotlight,
      shouldWatchSpotlight: this.shouldBreathe,
      onResize: () => this.drawEverySquare(),
      onThemeChange: () => {
        this.shadeColors = readShadeColors(canvas);
        this.drawEverySquare();
      },
      onSpotlightChange: () => {
        if (this.isSpotlightLit()) {
          this.startAnimation();
        }
      },
    });
  }

  /** Fades the squares onto new days. */
  showDayLevels(dayLevels: readonly number[]): void {
    this.targetLevels.set(mapDaysToCells(this.cells, dayLevels));
    this.startAnimation();
  }

  stop(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
    this.frameId = 0;
    this.stopObservers();
  }

  private drawEverySquare(): void {
    this.options.canvas.dataset.drawn = "true";
    for (let cellIndex = 0; cellIndex < this.cells.length; cellIndex++) {
      this.lastShades[cellIndex] = findShadeIndex(
        this.shownLevels[cellIndex] ?? 0,
      );
    }
    drawActivityGraph(
      this.graphCanvas,
      this.cells,
      this.shownLevels,
      this.shadeColors,
    );
  }

  private isSpotlightLit(): boolean {
    const spotlightOpacity = parseFloat(
      this.options.spotlight.style.getPropertyValue("--spotlight-opacity"),
    );
    return spotlightOpacity > 0.01;
  }

  private startAnimation(): void {
    if (this.frameId) {
      return;
    }
    // Read again as the graph wakes, so a stylesheet swap never leaves stale shades.
    this.shadeColors = readShadeColors(this.options.canvas);
    this.frameId = requestAnimationFrame(this.animateFrame);
  }

  private readonly animateFrame = (nowMs: number): void => {
    const elapsedMs = this.lastFrameMs
      ? Math.min(nowMs - this.lastFrameMs, longestFrameMs)
      : 16;
    this.lastFrameMs = nowMs;
    const isLit = this.shouldBreathe && this.isSpotlightLit();
    this.stepBreathEnvelope(isLit, elapsedMs);
    const { changedCellIndices, isStillFading } = this.stepLevels(
      nowMs,
      elapsedMs,
    );
    this.paintChangedSquares(changedCellIndices);

    if (isLit || this.breathEnvelope > 0 || isStillFading) {
      this.frameId = requestAnimationFrame(this.animateFrame);
      return;
    }
    this.frameId = 0;
    this.lastFrameMs = 0;
  };

  private stepBreathEnvelope(isLit: boolean, elapsedMs: number): void {
    this.breathEnvelope = easeToward(
      this.breathEnvelope,
      isLit ? 1 : 0,
      elapsedMs,
      breathEnvelopeMs,
    );
    if (!isLit && this.breathEnvelope < breathEnvelopeSettle) {
      this.breathEnvelope = 0;
    }
    const isBreathing = this.breathEnvelope > 0;
    if ((this.options.canvas.dataset.breathing === "true") !== isBreathing) {
      this.options.canvas.dataset.breathing = String(isBreathing);
    }
  }

  private stepLevels(nowMs: number, elapsedMs: number) {
    const changedCellIndices: number[] = [];
    let isStillFading = false;
    for (let cellIndex = 0; cellIndex < this.cells.length; cellIndex++) {
      const targetLevel = this.targetLevels[cellIndex] ?? 0;
      const restingLevel = this.restingLevels[cellIndex] ?? 0;
      if (restingLevel !== targetLevel) {
        const nextLevel = easeToward(
          restingLevel,
          targetLevel,
          elapsedMs,
          this.levelFadeMs,
        );
        const isSettled =
          Math.abs(nextLevel - targetLevel) < levelSettleDistance;
        this.restingLevels[cellIndex] = isSettled ? targetLevel : nextLevel;
        isStillFading ||= !isSettled;
      }
      const wave = this.breathEnvelope
        ? Math.sin(
            (this.breathPhases[cellIndex] ?? 0) +
              (nowMs / (this.breathPeriodsMs[cellIndex] ?? breathPeriodMinMs)) *
                Math.PI *
                2,
          )
        : 0;
      this.shownLevels[cellIndex] = breatheLevel(
        this.restingLevels[cellIndex] ?? 0,
        wave,
        this.breathEnvelope,
      );
      const shadeIndex = findShadeIndex(this.shownLevels[cellIndex] ?? 0);
      if (shadeIndex !== this.lastShades[cellIndex]) {
        this.lastShades[cellIndex] = shadeIndex;
        changedCellIndices.push(cellIndex);
      }
    }
    return { changedCellIndices, isStillFading };
  }

  private paintChangedSquares(changedCellIndices: number[]): void {
    if (changedCellIndices.length > this.cells.length * fullRepaintShare) {
      this.drawEverySquare();
      return;
    }
    if (changedCellIndices.length > 0) {
      drawChangedSquares(
        this.graphCanvas,
        this.cells,
        this.cellNeighbours,
        changedCellIndices,
        this.shownLevels,
        this.shadeColors,
      );
    }
  }
}
