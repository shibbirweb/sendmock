// The GitHub milestones the roadmap uses, one per release, in release order. Each feature
// names its release at the start of its acceptance intro ("1.3.0 (A18), ..."), and the
// project board's Target field has the same names as options.

export const firstBetaMilestone = "First beta (0.1.0-beta.1)";
export const waitingOnOthersMilestone = "Waiting on others";

export const releaseMilestones = [
  firstBetaMilestone,
  "1.0.0",
  "1.1.0",
  "1.2.0",
  "1.3.0",
  "1.4.0",
  "1.5.0",
  "1.6.0",
  "2.0.0",
  waitingOnOthersMilestone,
];

/** The releases already out; the rest are planned. */
export const releasedMilestones = new Set([
  firstBetaMilestone,
  "1.0.0",
  "1.1.0",
]);

/**
 * A feature's release from the start of its acceptance intro: "Waiting on others", a
 * version ("1.3.0 (A18)", "0.1.0-beta.1 (planned as ...)"), or a plan phase for the work
 * that led to 1.0, which shipped in the first beta when done and is due in 1.0.0 otherwise.
 */
export function readReleaseMilestone(phase: string, isDone: boolean): string {
  if (phase.startsWith(waitingOnOthersMilestone)) {
    return waitingOnOthersMilestone;
  }
  if (/^0\.1\.0-beta\.1\b/.test(phase)) {
    return firstBetaMilestone;
  }
  const version = /^(\d+\.\d+\.\d+)\b/.exec(phase)?.[1];
  if (version !== undefined) {
    if (!releaseMilestones.includes(version)) {
      throw new Error(
        `Release ${version} has no milestone; add it to release-milestones.ts.`,
      );
    }
    return version;
  }
  if (phase.startsWith("After 1.0")) {
    throw new Error(
      `"${phase.slice(0, 60)}" names no release; start the intro with a release from release-milestones.ts.`,
    );
  }
  return isDone ? firstBetaMilestone : "1.0.0";
}
