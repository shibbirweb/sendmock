import { http, HttpResponse } from "msw";

import type {
  PaymentFlowInput,
  PaymentFlowStep,
  PaymentFlowStepAddRequest,
  PaymentFlowStepUpdateRequest,
} from "@/lib/api/types";
import {
  addFlowStep,
  removeFlowStep,
  updateFlowStep,
} from "@/lib/payments/edit-flow-steps";
import {
  buildDefaultStep,
  paymentStepCatalogue,
} from "@/lib/payments/payment-step-catalogue";
import { validatePaymentFlow } from "@/lib/payments/validate-payment-flow";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import {
  applyFlowInput,
  findShippedFlow,
  presentPaymentFlow,
} from "@/mocks/payments/payment-flow-record";

function findFlowIndex(flowKey: unknown): number {
  return mockDatabase.paymentFlows.findIndex(
    (flowRecord) => flowRecord.key === flowKey,
  );
}

/** Validates the whole flow with its new input, then stores it (PY-12.6). */
function saveFlowAt(flowIndex: number, flowInput: PaymentFlowInput) {
  const flowRecord = mockDatabase.paymentFlows[flowIndex];
  if (flowRecord === undefined) {
    return createNotFoundResponse("Payment flow");
  }
  const checkedInput = { ...flowInput, key: flowRecord.key };
  const firstError = Object.values(
    validatePaymentFlow(checkedInput, mockDatabase.paymentFlows, false),
  )[0];
  if (firstError !== undefined) {
    return createErrorResponse(400, "validation_failed", firstError);
  }
  const savedRecord = applyFlowInput(flowRecord, checkedInput);
  mockDatabase.paymentFlows[flowIndex] = savedRecord;

  return HttpResponse.json(presentPaymentFlow(mockDatabase, savedRecord));
}

/** One step changed at a time, for the CLI and MCP tools (PY-12.5, PY-12.6). */
function changeStepsOf(
  flowKey: unknown,
  changeSteps: (flowSteps: PaymentFlowStep[]) => PaymentFlowStep[] | null,
) {
  const flowIndex = findFlowIndex(flowKey);
  const flowRecord = mockDatabase.paymentFlows[flowIndex];
  if (flowRecord === undefined) {
    return createNotFoundResponse("Payment flow");
  }
  const changedSteps = changeSteps(flowRecord.steps);
  if (changedSteps === null) {
    return createNotFoundResponse("Flow step");
  }

  return saveFlowAt(flowIndex, { ...flowRecord, steps: changedSteps });
}

/** Payments > Flows (PY-12.6); registered before `/payments/:paymentId`. */
export const paymentFlowHandlers = [
  http.get("*/api/v1/payments/step-types", async () => {
    await applyMockConditions();

    return HttpResponse.json(Object.values(paymentStepCatalogue));
  }),

  http.get("*/api/v1/payments/flows", async () => {
    await applyMockConditions();

    return HttpResponse.json(
      mockDatabase.paymentFlows.map((flowRecord) =>
        presentPaymentFlow(mockDatabase, flowRecord),
      ),
    );
  }),

  http.post("*/api/v1/payments/flows", async ({ request }) => {
    await applyMockConditions();
    const flowInput = (await request.json()) as PaymentFlowInput;
    const firstError = Object.values(
      validatePaymentFlow(flowInput, mockDatabase.paymentFlows, true),
    )[0];
    if (firstError !== undefined) {
      return createErrorResponse(400, "validation_failed", firstError);
    }
    const flowRecord = { ...flowInput, is_builtin: false };
    mockDatabase.paymentFlows.push(flowRecord);

    return HttpResponse.json(presentPaymentFlow(mockDatabase, flowRecord), {
      status: 201,
    });
  }),

  http.patch(
    "*/api/v1/payments/flows/:flowKey",
    async ({ params, request }) => {
      await applyMockConditions();

      return saveFlowAt(
        findFlowIndex(params.flowKey),
        (await request.json()) as PaymentFlowInput,
      );
    },
  ),

  http.post("*/api/v1/payments/flows/:flowKey/reset", async ({ params }) => {
    await applyMockConditions();
    const flowIndex = findFlowIndex(params.flowKey);
    const shippedFlow = findShippedFlow(String(params.flowKey));
    if (flowIndex === -1) {
      return createNotFoundResponse("Payment flow");
    }
    if (shippedFlow === undefined) {
      return createErrorResponse(
        409,
        "not_builtin",
        "Only built-in flows have a default to go back to",
      );
    }
    mockDatabase.paymentFlows[flowIndex] = shippedFlow;

    return HttpResponse.json(presentPaymentFlow(mockDatabase, shippedFlow));
  }),

  http.delete("*/api/v1/payments/flows/:flowKey", async ({ params }) => {
    await applyMockConditions();
    const flowIndex = findFlowIndex(params.flowKey);
    const flowRecord = mockDatabase.paymentFlows[flowIndex];
    if (flowRecord === undefined) {
      return createNotFoundResponse("Payment flow");
    }
    const { method_count: methodCount } = presentPaymentFlow(
      mockDatabase,
      flowRecord,
    );
    if (flowRecord.is_builtin) {
      return createErrorResponse(
        409,
        "builtin_flow",
        "Built-in flows cannot be deleted; reset it to default instead",
      );
    }
    if (methodCount > 0) {
      return createErrorResponse(
        409,
        "flow_in_use",
        `${methodCount} methods use ${flowRecord.name}; delete those methods first`,
      );
    }
    mockDatabase.paymentFlows.splice(flowIndex, 1);

    return new HttpResponse(null, { status: 204 });
  }),

  http.post(
    "*/api/v1/payments/flows/:flowKey/steps",
    async ({ params, request }) => {
      await applyMockConditions();
      const addRequest = (await request.json()) as PaymentFlowStepAddRequest;
      // Labels left out take the catalogue's, so `{ type: "otp" }` is enough.
      const addedStep =
        addRequest.step.type in paymentStepCatalogue
          ? { ...buildDefaultStep(addRequest.step.type), ...addRequest.step }
          : addRequest.step;

      return changeStepsOf(params.flowKey, (flowSteps) =>
        addFlowStep(flowSteps, addedStep, addRequest.position),
      );
    },
  ),

  http.patch(
    "*/api/v1/payments/flows/:flowKey/steps/:stepIndex",
    async ({ params, request }) => {
      await applyMockConditions();
      const stepIndex = Number(params.stepIndex);
      const stepUpdate = (await request.json()) as PaymentFlowStepUpdateRequest;

      return changeStepsOf(params.flowKey, (flowSteps) =>
        flowSteps[stepIndex] === undefined
          ? null
          : updateFlowStep(flowSteps, stepIndex, stepUpdate),
      );
    },
  ),

  http.delete(
    "*/api/v1/payments/flows/:flowKey/steps/:stepIndex",
    async ({ params }) => {
      await applyMockConditions();
      const stepIndex = Number(params.stepIndex);

      return changeStepsOf(params.flowKey, (flowSteps) =>
        flowSteps[stepIndex] === undefined
          ? null
          : removeFlowStep(flowSteps, stepIndex),
      );
    },
  ),
];
