import { automationHandlers } from "@/mocks/handlers/automation-handlers";
import { definitionLookupHandlers } from "@/mocks/handlers/definition-lookup-handlers";
import { emailDetailHandlers } from "@/mocks/handlers/email-detail-handlers";
import { emailImportHandlers } from "@/mocks/handlers/email-import-handlers";
import { messageRuleHandlers } from "@/mocks/handlers/message-rule-handlers";
import { outcomeTestHandlers } from "@/mocks/handlers/outcome-test-handlers";
import { paymentTestValueHandlers } from "@/mocks/handlers/payment-test-value-handlers";
import { waitHandlers } from "@/mocks/handlers/wait-handlers";
import { emailHandlers } from "@/mocks/handlers/email-handlers";
import { emailResponseHandlers } from "@/mocks/handlers/email-response-handlers";
import { httpBinHandlers } from "@/mocks/handlers/http-bin-handlers";
import { httpRequestHandlers } from "@/mocks/handlers/http-request-handlers";
import { logsHandlers } from "@/mocks/handlers/logs-handlers";
import { nativeSendHandlers } from "@/mocks/handlers/native-send-handlers";
import { numbersHandlers } from "@/mocks/handlers/numbers-handlers";
import { outcomeRulesHandlers } from "@/mocks/handlers/outcome-rules-handlers";
import { checkoutHandlers } from "@/mocks/handlers/checkout-handlers";
import { paymentHandlers } from "@/mocks/handlers/payment-handlers";
import { inboundRouteHandlers } from "@/mocks/handlers/inbound-route-handlers";
import { paymentFlowHandlers } from "@/mocks/handlers/payment-flow-handlers";
import { paymentGatewayHandlers } from "@/mocks/handlers/payment-gateway-handlers";
import { paymentMethodHandlers } from "@/mocks/handlers/payment-method-handlers";
import { samplesHandlers } from "@/mocks/handlers/samples-handlers";
import { settingsHandlers } from "@/mocks/handlers/settings-handlers";
import { simulatedErrorHandler } from "@/mocks/handlers/simulated-error-handler";
import { smsHandlers } from "@/mocks/handlers/sms-handlers";
import { smsSendHandlers } from "@/mocks/handlers/sms-send-handlers";
import { systemHandlers } from "@/mocks/handlers/system-handlers";
import { verifyHandlers } from "@/mocks/handlers/verify-handlers";
import { webhookDeliveryHandlers } from "@/mocks/handlers/webhook-delivery-handlers";
import { webhookEndpointHandlers } from "@/mocks/handlers/webhook-endpoint-handlers";
import { webhookMetricsHandlers } from "@/mocks/handlers/webhook-metrics-handlers";
import { webhookRuleHandlers } from "@/mocks/handlers/webhook-rule-handlers";
import { webhookSavedHandlers } from "@/mocks/handlers/webhook-saved-handlers";
import { webhookTemplateEditHandlers } from "@/mocks/handlers/webhook-template-edit-handlers";
import { webhookTemplateHandlers } from "@/mocks/handlers/webhook-template-handlers";
import { webhookVariableHandlers } from "@/mocks/handlers/webhook-variable-handlers";
import { realtimeConnectionHandler } from "@/mocks/realtime/mock-event-bus";

/** Every mock API handler, matching the paths in docs/plan/06-api.md. */
export const mockHandlers = [
  simulatedErrorHandler,
  ...systemHandlers,
  ...settingsHandlers,
  ...waitHandlers,
  ...automationHandlers,
  // Before the `:emailId`, `:paymentId` and `:ruleId` routes they would collide with.
  ...emailImportHandlers,
  ...paymentTestValueHandlers,
  ...outcomeTestHandlers,
  ...definitionLookupHandlers,
  ...messageRuleHandlers,
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
  ...httpBinHandlers,
  ...httpRequestHandlers,
  ...samplesHandlers,
  ...inboundRouteHandlers,
  ...paymentFlowHandlers,
  ...paymentGatewayHandlers,
  ...paymentMethodHandlers,
  ...paymentHandlers,
  ...checkoutHandlers,
  ...webhookEndpointHandlers,
  ...webhookMetricsHandlers,
  ...webhookVariableHandlers,
  ...webhookRuleHandlers,
  ...webhookDeliveryHandlers,
  ...webhookSavedHandlers,
  ...webhookTemplateEditHandlers,
  ...webhookTemplateHandlers,
  realtimeConnectionHandler,
];
