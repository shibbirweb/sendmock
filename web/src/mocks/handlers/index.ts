import { emailDetailHandlers } from "@/mocks/handlers/email-detail-handlers";
import { emailHandlers } from "@/mocks/handlers/email-handlers";
import { emailResponseHandlers } from "@/mocks/handlers/email-response-handlers";
import { logsHandlers } from "@/mocks/handlers/logs-handlers";
import { nativeSendHandlers } from "@/mocks/handlers/native-send-handlers";
import { numbersHandlers } from "@/mocks/handlers/numbers-handlers";
import { outcomeRulesHandlers } from "@/mocks/handlers/outcome-rules-handlers";
import { samplesHandlers } from "@/mocks/handlers/samples-handlers";
import { settingsHandlers } from "@/mocks/handlers/settings-handlers";
import { smsHandlers } from "@/mocks/handlers/sms-handlers";
import { smsSendHandlers } from "@/mocks/handlers/sms-send-handlers";
import { systemHandlers } from "@/mocks/handlers/system-handlers";
import { verifyHandlers } from "@/mocks/handlers/verify-handlers";
import { webhookDeliveryHandlers } from "@/mocks/handlers/webhook-delivery-handlers";
import { webhookEndpointHandlers } from "@/mocks/handlers/webhook-endpoint-handlers";
import { webhookRuleHandlers } from "@/mocks/handlers/webhook-rule-handlers";
import { webhookSavedHandlers } from "@/mocks/handlers/webhook-saved-handlers";
import { webhookTemplateEditHandlers } from "@/mocks/handlers/webhook-template-edit-handlers";
import { webhookTemplateHandlers } from "@/mocks/handlers/webhook-template-handlers";
import { webhookVariableHandlers } from "@/mocks/handlers/webhook-variable-handlers";
import { realtimeConnectionHandler } from "@/mocks/realtime/mock-event-bus";

/** Every mock API handler, matching the paths in docs/plan/06-api.md. */
export const mockHandlers = [
  ...systemHandlers,
  ...settingsHandlers,
  ...emailDetailHandlers,
  ...nativeSendHandlers,
  ...emailHandlers,
  ...emailResponseHandlers,
  ...smsSendHandlers,
  ...smsHandlers,
  ...verifyHandlers,
  ...numbersHandlers,
  ...outcomeRulesHandlers,
  ...logsHandlers,
  ...samplesHandlers,
  ...webhookEndpointHandlers,
  ...webhookVariableHandlers,
  ...webhookRuleHandlers,
  ...webhookDeliveryHandlers,
  ...webhookSavedHandlers,
  ...webhookTemplateEditHandlers,
  ...webhookTemplateHandlers,
  realtimeConnectionHandler,
];
