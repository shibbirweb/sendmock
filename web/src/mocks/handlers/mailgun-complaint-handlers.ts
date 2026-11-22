import { http, HttpResponse } from "msw";

import { mockDatabase } from "@/mocks/db/mock-database";
import { applyMockConditions } from "@/mocks/handlers/handler-utils";

/** Mailgun domains' complaints tables (EM-23). */
export const mailgunComplaintHandlers = [
  http.get("*/api/v1/mailgun/complaints", async ({ request }) => {
    await applyMockConditions();
    const domain = new URL(request.url).searchParams.get("domain");

    return HttpResponse.json(
      mockDatabase.mailgunComplaints.filter(
        (complaint) => domain === null || complaint.domain === domain,
      ),
    );
  }),

  http.delete("*/api/v1/mailgun/complaints/:domain", async ({ params }) => {
    await applyMockConditions();
    mockDatabase.mailgunComplaints = mockDatabase.mailgunComplaints.filter(
      (complaint) => complaint.domain !== params.domain,
    );

    return new HttpResponse(null, { status: 204 });
  }),
];
