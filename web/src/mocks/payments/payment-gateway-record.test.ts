import { describe, expect, test } from "vitest";

import { createMockDatabase } from "@/mocks/db/mock-database";
import {
  applyGatewayInput,
  buildCustomGateway,
  findGatewayRecord,
  findShippedGateway,
  mergeCredentials,
  presentPaymentGateway,
} from "@/mocks/payments/payment-gateway-record";

function readSslcommerz() {
  const mockDatabase = createMockDatabase("standard");
  const gatewayRecord = findGatewayRecord(mockDatabase, "sslcommerz");
  if (gatewayRecord === undefined) {
    throw new Error("The fixtures need the SSLCommerz gateway.");
  }

  return { mockDatabase, gatewayRecord };
}

describe("payment gateway records", () => {
  test("PY-12.2 secrets are masked when presented, with usage and Modified", () => {
    const { mockDatabase, gatewayRecord } = readSslcommerz();
    const presentedGateway = presentPaymentGateway(mockDatabase, gatewayRecord);

    expect(presentedGateway.credentials).toEqual([
      { name: "store_id", value: "sendm0000000001", is_secret: false },
      { name: "store_passwd", value: "••••@ssl", is_secret: true },
    ]);
    expect(presentedGateway.is_modified).toBe(false);
    expect(presentedGateway.payment_count).toBeGreaterThan(0);
    expect(gatewayRecord.credentials[1]?.value).toBe("sendm0000000001@ssl");
  });

  test("PY-12.2 a masked or empty secret sent back keeps the stored one", () => {
    const { gatewayRecord } = readSslcommerz();

    expect(
      mergeCredentials(gatewayRecord.credentials, [
        { name: "store_id", value: "changed", is_secret: false },
        { name: "store_passwd", value: "••••@ssl", is_secret: true },
      ]),
    ).toEqual([
      { name: "store_id", value: "changed", is_secret: false },
      { name: "store_passwd", value: "sendm0000000001@ssl", is_secret: true },
    ]);
    expect(
      mergeCredentials(gatewayRecord.credentials, [
        { name: "store_passwd", value: "", is_secret: true },
      ])[0]?.value,
    ).toBe("sendm0000000001@ssl");
  });

  test("PY-12.2 an edited built-in is Modified; its shipped version is kept for reset", () => {
    const { mockDatabase, gatewayRecord } = readSslcommerz();
    const editedGateway = applyGatewayInput(gatewayRecord, {
      ...gatewayRecord,
      key: "renamed",
      event_names: {
        ...gatewayRecord.event_names,
        "payment.succeeded": "VALIDATED",
      },
    });

    expect(editedGateway.key).toBe("sslcommerz");
    expect(presentPaymentGateway(mockDatabase, editedGateway).is_modified).toBe(
      true,
    );
    expect(
      findShippedGateway(mockDatabase, "sslcommerz")?.event_names[
        "payment.succeeded"
      ],
    ).toBe("VALID");
  });

  test("PY-12.2 a custom gateway copies a built-in's shapes, or starts blank with Card", () => {
    const { mockDatabase } = readSslcommerz();
    const copiedGateway = buildCustomGateway(
      mockDatabase,
      "nagad_pay",
      "Nagad Pay",
      "sslcommerz",
    );
    expect(copiedGateway).toMatchObject({
      key: "nagad_pay",
      name: "Nagad Pay",
      is_builtin: false,
      redirect_method: "POST",
      notification_content_type: "form",
    });

    const blankGateway = buildCustomGateway(mockDatabase, "upay", "Upay", null);
    expect(blankGateway.method_keys).toEqual(["card"]);
    expect(blankGateway.redirect_method).toBe("GET");
  });
});
