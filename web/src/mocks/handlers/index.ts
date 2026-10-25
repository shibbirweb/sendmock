import { emailDetailHandlers } from "@/mocks/handlers/email-detail-handlers";
import { emailHandlers } from "@/mocks/handlers/email-handlers";
import { emailResponseHandlers } from "@/mocks/handlers/email-response-handlers";
import { smsHandlers } from "@/mocks/handlers/sms-handlers";
import { smsSendHandlers } from "@/mocks/handlers/sms-send-handlers";
import { systemHandlers } from "@/mocks/handlers/system-handlers";
import { webhookHandlers } from "@/mocks/handlers/webhook-handlers";
import { realtimeConnectionHandler } from "@/mocks/realtime/mock-event-bus";

/** Every mock API handler, matching the paths in docs/plan/06-api.md. */
export const mockHandlers = [
  ...systemHandlers,
  ...emailDetailHandlers,
  ...emailHandlers,
  ...emailResponseHandlers,
  ...smsSendHandlers,
  ...smsHandlers,
  ...webhookHandlers,
  realtimeConnectionHandler,
];
