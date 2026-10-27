import type { ApiEndpoint } from "./endpoint-definition";
import { automationApi } from "./automation-api";
import { emailApi } from "./email-api";
import { httpCatcherApi } from "./http-catcher-api";
import { messageProvidersApi } from "./message-providers-api";
import { messageRulesApi } from "./message-rules-api";
import { numbersApi } from "./numbers-api";
import { paymentConfigApi } from "./payment-config-api";
import { paymentsApi } from "./payments-api";
import { smsApi } from "./sms-api";
import { systemApi } from "./system-api";
import { webhookDeliveriesApi } from "./webhook-deliveries-api";
import { webhookTemplatesApi } from "./webhook-templates-api";
import { webhooksApi } from "./webhooks-api";

export type {
  ApiEndpoint,
  QueryParameter,
  SchemaReference,
} from "./endpoint-definition";

/**
 * Every REST endpoint SendMock serves, in the order of docs/plan/06-api.md.
 * docs/api/openapi.yaml is generated from this list and the API types
 * (`bun run openapi`); a test keeps it equal to the mock handlers (UI-09.1).
 */
export const apiEndpoints: ApiEndpoint[] = [
  ...systemApi,
  ...automationApi,
  ...emailApi,
  ...messageRulesApi,
  ...smsApi,
  ...numbersApi,
  ...messageProvidersApi,
  ...httpCatcherApi,
  ...paymentsApi,
  ...paymentConfigApi,
  ...webhooksApi,
  ...webhookDeliveriesApi,
  ...webhookTemplatesApi,
];
