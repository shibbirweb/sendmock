import { describe, expect, test } from "vitest";

import { apiEndpoints } from "@/lib/api/endpoint-registry";
import openApiDocument from "@/mocks/generated/openapi-document.json";
import {
  buildCurlCommand,
  filterReferenceOperations,
  type OpenApiDocument,
  readReferenceOperations,
  readTagFromPath,
} from "@/lib/api/openapi-reference";

const referenceOperations = readReferenceOperations(
  openApiDocument as OpenApiDocument,
);

describe("API reference", () => {
  test("PL-01.4 every operation is read with its parameters, body and answer", () => {
    const simulateOperation = referenceOperations.find(
      (referenceOperation) =>
        referenceOperation.operationId === "postPaymentsByPaymentIdSimulate",
    );
    const listOperation = referenceOperations.find(
      (referenceOperation) =>
        referenceOperation.operationId === "getPaymentsSubscriptions",
    );

    expect(referenceOperations).toHaveLength(apiEndpoints.length);
    expect(simulateOperation).toMatchObject({
      method: "POST",
      tag: "Payments",
      requestBodyType: "PaymentSimulateRequest",
      responseType: "PaymentDetail",
      successStatus: "200",
    });
    expect(simulateOperation?.parameters[0]).toMatchObject({
      name: "paymentId",
      location: "path",
      isRequired: true,
    });
    expect(listOperation?.responseType).toBe("PaymentSubscription[]");
  });

  test("PL-01.4 a curl command names this instance and fills the path", () => {
    const simulateOperation = referenceOperations.find(
      (referenceOperation) =>
        referenceOperation.operationId === "postPaymentsByPaymentIdSimulate",
    );

    expect(
      simulateOperation === undefined
        ? ""
        : buildCurlCommand(simulateOperation, "http://127.0.0.1:8025"),
    ).toBe(
      "curl -X POST -H 'Content-Type: application/json' -d '{}' 'http://127.0.0.1:8025/api/v1/payments/01JB7T9Q2R5W8X3Y6Z1A4B7C9D/simulate'",
    );
  });

  test("PL-01.4 search keeps the operations that contain every word", () => {
    const found = filterReferenceOperations(
      referenceOperations,
      "subscription cancel",
    );

    expect(
      found.map((referenceOperation) => referenceOperation.operationId),
    ).toEqual(["postPaymentsSubscriptionsBySubscriptionIdCancel"]);
  });

  test("PL-01.4 an operation without tags is grouped by its path", () => {
    expect(readTagFromPath("/api/v1/payments/subscriptions")).toBe("Payments");
    expect(readTagFromPath("/api/v1/sms/{smsId}")).toBe("SMS");
    expect(readTagFromPath("/api/v1/inbound-routes")).toBe("Inbound routes");
    expect(readTagFromPath("/catch/{binPath}")).toBe("Catch");
  });
});
