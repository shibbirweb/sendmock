import { emailHandlers } from "@/mocks/handlers/email-handlers";
import { smsHandlers } from "@/mocks/handlers/sms-handlers";
import { systemHandlers } from "@/mocks/handlers/system-handlers";
import { webhookHandlers } from "@/mocks/handlers/webhook-handlers";
import { realtimeConnectionHandler } from "@/mocks/realtime/mock-event-bus";

/** Every mock API handler, matching the paths in docs/plan/06-api.md. */
export const mockHandlers = [
  ...systemHandlers,
  ...emailHandlers,
  ...smsHandlers,
  ...webhookHandlers,
  realtimeConnectionHandler,
];
