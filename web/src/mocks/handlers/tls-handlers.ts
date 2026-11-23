import { http, HttpResponse } from "msw";

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

  http.get("*/api/v1/tls/trust", async () => {
    await applyMockConditions();

    return HttpResponse.json({
      ca_path: "/home/sam/.local/share/sendmock/provider-ca-certificate.pem",
      places: [
        {
          place: "Linux CA folder",
          state: "missing",
          detail:
            "/usr/local/share/ca-certificates, read by curl, OpenSSL and most runtimes.",
        },
        {
          place: "Node.js",
          state: "manual",
          detail:
            "Set NODE_EXTRA_CA_CERTS=/home/sam/.local/share/sendmock/provider-ca-certificate.pem",
        },
      ],
    });
  }),
];
