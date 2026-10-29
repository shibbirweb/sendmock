import { sampleRate } from "./audio-buffer";

export type FilterKind = "lowpass" | "highpass" | "bandpass";

/**
 * A biquad filter (RBJ audio EQ cookbook). The cutoff can change per sample
 * for sweeps; coefficients are recalculated only when it moves noticeably.
 */
export class BiquadFilter {
  private feedForward = [1, 0, 0];
  private feedBack = [0, 0];
  private inputHistory = [0, 0];
  private outputHistory = [0, 0];
  private lastCutoffHz = -1;

  constructor(
    private readonly filterKind: FilterKind,
    private readonly resonance = 0.707,
  ) {}

  process(inputValue: number, cutoffHz: number): number {
    if (Math.abs(cutoffHz - this.lastCutoffHz) > 1) {
      this.updateCoefficients(cutoffHz);
    }
    const [b0 = 1, b1 = 0, b2 = 0] = this.feedForward;
    const [a1 = 0, a2 = 0] = this.feedBack;
    const [x1 = 0, x2 = 0] = this.inputHistory;
    const [y1 = 0, y2 = 0] = this.outputHistory;
    const outputValue = b0 * inputValue + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    this.inputHistory = [inputValue, x1];
    this.outputHistory = [outputValue, y1];
    return outputValue;
  }

  private updateCoefficients(cutoffHz: number) {
    this.lastCutoffHz = cutoffHz;
    const clampedCutoffHz = Math.min(Math.max(cutoffHz, 20), sampleRate * 0.45);
    const angularFrequency = (2 * Math.PI * clampedCutoffHz) / sampleRate;
    const cosine = Math.cos(angularFrequency);
    const alpha = Math.sin(angularFrequency) / (2 * this.resonance);
    const normaliser = 1 + alpha;
    if (this.filterKind === "lowpass") {
      this.feedForward = [(1 - cosine) / 2, 1 - cosine, (1 - cosine) / 2];
    } else if (this.filterKind === "highpass") {
      this.feedForward = [(1 + cosine) / 2, -(1 + cosine), (1 + cosine) / 2];
    } else {
      this.feedForward = [alpha, 0, -alpha];
    }
    this.feedForward = this.feedForward.map(
      (coefficient) => coefficient / normaliser,
    );
    this.feedBack = [(-2 * cosine) / normaliser, (1 - alpha) / normaliser];
  }
}
