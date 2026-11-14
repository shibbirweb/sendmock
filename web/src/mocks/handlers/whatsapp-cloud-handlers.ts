import { http, HttpResponse } from "msw";

import type {
  WhatsappWebhookVerification,
  WhatsappWebhookVerificationRequest,
} from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
} from "@/mocks/handlers/handler-utils";

function readCloudCredential(credentialName: string): string {
  const cloudProvider = mockDatabase.messageProviders.find(
    (provider) => provider.key === "whatsapp_cloud",
  );

  return (
    cloudProvider?.credentials.find(
      (credential) => credential.name === credentialName,
    )?.value ?? ""
  );
}

/** The demo has no app to call, so the check always finds the challenge answered. */
export const whatsappCloudHandlers = [
  http.post(
    "*/api/v1/sms/whatsapp-cloud/verify-webhook",
    async ({ request }) => {
      const conditionResponse = await applyMockConditions();
      if (conditionResponse) {
        return conditionResponse;
      }
      const verificationRequest =
        (await request.json()) as WhatsappWebhookVerificationRequest;
      const callbackUrl =
        verificationRequest.url ?? readCloudCredential("webhook_url");
      if (callbackUrl === "") {
        return createErrorResponse(
          422,
          "invalid_input",
          "Set the WhatsApp Cloud provider's webhook_url, or pass url",
        );
      }
      const challenge = "1158201444";
      const verification: WhatsappWebhookVerification = {
        url: `${callbackUrl}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(readCloudCredential("verify_token"))}&hub.challenge=${challenge}`,
        challenge,
        is_verified: true,
        status_code: 200,
        answer: challenge,
        error: null,
      };

      return HttpResponse.json(verification);
    },
  ),
];
