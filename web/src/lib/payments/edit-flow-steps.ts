import type {
  PaymentFlowStep,
  PaymentFlowStepUpdateRequest,
} from "@/lib/api/types";

/**
 * One change to a flow's steps at a time (PY-12.6), the same for the Flows
 * screen and the single-step API used by the CLI and MCP tools. Each returns a
 * new list and leaves the given one untouched.
 */

function clampPosition(position: number, stepCount: number): number {
  return Math.min(Math.max(Math.trunc(position), 0), stepCount);
}

export function addFlowStep(
  flowSteps: PaymentFlowStep[],
  addedStep: PaymentFlowStep,
  position: number = flowSteps.length,
): PaymentFlowStep[] {
  const insertAt = clampPosition(position, flowSteps.length);

  return [
    ...flowSteps.slice(0, insertAt),
    addedStep,
    ...flowSteps.slice(insertAt),
  ];
}

export function moveFlowStep(
  flowSteps: PaymentFlowStep[],
  stepIndex: number,
  position: number,
): PaymentFlowStep[] {
  const movedStep = flowSteps[stepIndex];
  if (movedStep === undefined) {
    return flowSteps;
  }
  const remainingSteps = flowSteps.filter(
    (_flowStep, candidateIndex) => candidateIndex !== stepIndex,
  );

  return addFlowStep(remainingSteps, movedStep, position);
}

export function removeFlowStep(
  flowSteps: PaymentFlowStep[],
  stepIndex: number,
): PaymentFlowStep[] {
  return flowSteps.filter(
    (_flowStep, candidateIndex) => candidateIndex !== stepIndex,
  );
}

/** New labels for one step, and a new position when one is given. */
export function updateFlowStep(
  flowSteps: PaymentFlowStep[],
  stepIndex: number,
  stepUpdate: PaymentFlowStepUpdateRequest,
): PaymentFlowStep[] {
  const { position, ...labelChanges } = stepUpdate;
  const relabelledSteps = flowSteps.map((flowStep, candidateIndex) =>
    candidateIndex === stepIndex ? { ...flowStep, ...labelChanges } : flowStep,
  );

  return position === undefined
    ? relabelledSteps
    : moveFlowStep(relabelledSteps, stepIndex, position);
}
