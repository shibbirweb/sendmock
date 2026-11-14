import type { DeeperPage } from "./deeper-types";
import { appShellPage } from "./screens/app-shell";
import { httpCatcherPage } from "./screens/http-catcher";
import { logsPage, scenariosPage } from "./screens/logs-scenarios";
import { numbersPage } from "./screens/numbers";
import { pushPage } from "./screens/push";
import {
  apiReferencePage,
  overviewPage,
} from "./screens/overview-api-reference";
import { mailInboxPage } from "./screens/mail-inbox";
import { mailProvidersPage } from "./screens/mail-providers";
import { paymentsGatewaysPage } from "./screens/payments-gateways";
import { paymentsFlowsPage } from "./screens/payments-flows";
import { paymentsListPage } from "./screens/payments-list";
import { paymentsMethodsPage } from "./screens/payments-methods";
import { paymentsSubscriptionsPage } from "./screens/payments-subscriptions";
import { settingsPage } from "./screens/settings";
import { smsMessagesPage } from "./screens/sms-messages";
import { smsProvidersPage } from "./screens/sms-providers";
import { smsVerifyPage } from "./screens/sms-verify";
import {
  webhooksComposerPage,
  webhooksSavedPage,
} from "./screens/webhooks-composer-saved";
import { webhooksDeliveriesPage } from "./screens/webhooks-deliveries";
import { webhooksEndpointsPage } from "./screens/webhooks-endpoints";
import { webhooksInboundRoutesPage } from "./screens/webhooks-inbound-routes";
import { webhooksOverviewPage } from "./screens/webhooks-overview";
import { webhooksRulesPage } from "./screens/webhooks-rules";
import { webhooksTemplatesPage } from "./screens/webhooks-templates";
import { webhooksVariablesPage } from "./screens/webhooks-variables";

/** Every Deeper page written so far (W14c onward adds a menu at a time). */
export const deeperPages: DeeperPage[] = [
  appShellPage,
  mailInboxPage,
  mailProvidersPage,
  smsMessagesPage,
  smsVerifyPage,
  smsProvidersPage,
  pushPage,
  webhooksOverviewPage,
  webhooksEndpointsPage,
  webhooksRulesPage,
  webhooksInboundRoutesPage,
  webhooksDeliveriesPage,
  webhooksComposerPage,
  webhooksTemplatesPage,
  webhooksVariablesPage,
  webhooksSavedPage,
  paymentsListPage,
  paymentsGatewaysPage,
  paymentsMethodsPage,
  paymentsFlowsPage,
  paymentsSubscriptionsPage,
  httpCatcherPage,
  numbersPage,
  logsPage,
  overviewPage,
  scenariosPage,
  apiReferencePage,
  settingsPage,
];

/** Screens of the inventory whose page is not written yet; the list only shrinks. */
export const pendingDeeperScreens: string[] = [];
