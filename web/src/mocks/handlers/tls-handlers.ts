import { http } from "msw";

import {
  applyMockConditions,
  createErrorResponse,
} from "@/mocks/handlers/handler-utils";

/** The demo runs without the HTTPS provider port, so it has no local CA (PL-20). */
export const tlsHandlers = [
  http.get("*/api/v1/tls/ca", async () => {
    await applyMockConditions();

    return createErrorResponse(
      404,
      "not_found",
      "SendMock has no local CA: start it with --provider-tls-addr and no --provider-tls-cert",
    );
  }),
];
