import type {
  ApiRequestLogEntry,
  AppSettings,
  CapturedHttpRequest,
  EmailDetail,
  EmailTimelineEntry,
  HttpBin,
  HttpResponseRule,
  PaymentDetail,
  MessagingService,
  SavedDelivery,
  SmsMessageDetail,
  SmtpSession,
  VerificationDetail,
  SmsOutcomeRule,
  EmailOutcomeRule,
  VerifyService,
  VirtualNumber,
  WebhookDelivery,
  WebhookRule,
  TemplateRevision,
  WebhookTemplateSummary,
  WebhookVariable,
} from "@/lib/api/types";
import {
  buildHttpBinFixtures,
  buildHttpResponseRuleFixtures,
} from "@/mocks/fixtures/http-catcher-fixtures";
import { buildPaymentFixtures } from "@/mocks/fixtures/payment-fixtures";
import {
  buildBuiltinPaymentMethods,
  type PaymentMethodRecord,
} from "@/mocks/fixtures/payment-method-fixtures";
import { buildDefaultSettings } from "@/mocks/fixtures/settings-fixtures";
import { buildHttpCatcherTraffic } from "@/mocks/http/build-http-catcher-traffic";
import {
  buildApiRequestLogFixtures,
  linkApiRequestFixtures,
} from "@/mocks/fixtures/api-request-fixtures";
import {
  buildLargeEmailFixtures,
  buildStandardEmailFixtures,
} from "@/mocks/fixtures/email-fixtures";
import { seedFixtureRandomness } from "@/mocks/fixtures/fixture-helpers";
import { buildStandardSmsFixtures } from "@/mocks/fixtures/sms-fixtures";
import { buildSmtpSessionFixtures } from "@/mocks/fixtures/smtp-session-fixtures";
import {
  buildSavedDeliveryFixtures,
  buildWebhookTemplateFixtures,
  buildWebhookVariableFixtures,
} from "@/mocks/fixtures/template-and-variable-fixtures";
import {
  buildVerificationFixtures,
  linkVerificationMessages,
  buildVerifyServiceFixtures,
} from "@/mocks/fixtures/verify-fixtures";
import {
  buildMessagingServiceFixtures,
  buildVirtualNumberFixtures,
} from "@/mocks/fixtures/number-fixtures";
import {
  buildEmailOutcomeRuleFixtures,
  buildSmsOutcomeRuleFixtures,
} from "@/mocks/fixtures/outcome-rule-fixtures";
import {
  buildWebhookDeliveryFixtures,
  buildWebhookEndpointFixtures,
  buildWebhookRuleFixtures,
  linkDeliverySubjects,
} from "@/mocks/fixtures/webhook-fixtures";
import { buildTemplateRevisionFixtures } from "@/mocks/fixtures/template-revision-fixtures";
import {
  readTemplateDefinition,
  type TemplateDefinition,
} from "@/mocks/fixtures/template-definitions";
import type { WebhookEndpointRecord } from "@/mocks/webhooks/webhook-endpoint-record";

/** In-memory state behind the mock API. Lists are kept newest first. */
export type MockDatabase = {
  /** When the seed state was last applied (creation, reset or seed apply). */
  seedAppliedAt: string;
  emails: EmailDetail[];
  emailTimelines: Map<string, EmailTimelineEntry[]>;
  /** Bytes of attachments sent through the native API, keyed `emailId/index`. */
  attachmentContents: Map<string, Uint8Array>;
  /** Bytes of SMS media sent inline, keyed `smsId/index`. */
  smsMediaContents: Map<string, Uint8Array>;
  smsMessages: SmsMessageDetail[];
  verifyServices: VerifyService[];
  verifications: VerificationDetail[];
  virtualNumbers: VirtualNumber[];
  messagingServices: MessagingService[];
  smsOutcomeRules: SmsOutcomeRule[];
  emailOutcomeRules: EmailOutcomeRule[];
  webhookEndpoints: WebhookEndpointRecord[];
  webhookRules: WebhookRule[];
  webhookDeliveries: WebhookDelivery[];
  webhookTemplates: WebhookTemplateSummary[];
  /** Request shapes of custom templates; built-in ones come from the fixtures. */
  customTemplateDefinitions: Map<string, TemplateDefinition>;
  /** Saved versions of custom and edited built-in templates, newest first. */
  templateRevisions: Map<string, TemplateRevision[]>;
  webhookVariables: WebhookVariable[];
  savedDeliveries: SavedDelivery[];
  payments: PaymentDetail[];
  paymentMethods: PaymentMethodRecord[];
  httpBins: HttpBin[];
  /** Each bin's response rules in order, by bin id. */
  httpResponseRules: Map<string, HttpResponseRule[]>;
  capturedHttpRequests: CapturedHttpRequest[];
  /** Uploaded file contents by `<requestId>:<fileIndex>`. */
  httpFileContents: Map<string, string>;
  smtpSessions: SmtpSession[];
  apiRequestLog: ApiRequestLogEntry[];
  settings: AppSettings;
};

export type MockDataSize = "standard" | "large" | "empty";

const largeDataSetEmailCount = 5000;
const largeDataSetApiRequestCount = 2000;

function sortNewestFirst<ItemType extends { id: string }>(
  items: ItemType[],
): ItemType[] {
  return [...items].sort((firstItem, secondItem) =>
    secondItem.id.localeCompare(firstItem.id),
  );
}

function buildConfiguration() {
  const virtualNumbers = buildVirtualNumberFixtures();
  const verifyServices = buildVerifyServiceFixtures();
  const webhookEndpoints = buildWebhookEndpointFixtures();
  const httpBins = buildHttpBinFixtures();
  const responseRulesByBinName = buildHttpResponseRuleFixtures();

  return {
    virtualNumbers,
    messagingServices: buildMessagingServiceFixtures(virtualNumbers),
    verifyServices,
    webhookEndpoints,
    webhookRules: buildWebhookRuleFixtures(webhookEndpoints),
    webhookTemplates: buildWebhookTemplateFixtures(),
    customTemplateDefinitions: new Map(),
    templateRevisions: buildTemplateRevisionFixtures(),
    webhookVariables: buildWebhookVariableFixtures(),
    savedDeliveries: buildSavedDeliveryFixtures(),
    httpBins,
    paymentMethods: buildBuiltinPaymentMethods(),
    httpResponseRules: new Map(
      httpBins.map((httpBin) => [
        httpBin.id,
        responseRulesByBinName[httpBin.name] ?? [],
      ]),
    ),
    smsOutcomeRules: buildSmsOutcomeRuleFixtures(),
    emailOutcomeRules: buildEmailOutcomeRuleFixtures(),
    settings: buildDefaultSettings(),
    seedAppliedAt: new Date().toISOString(),
  };
}

/** Builds a fresh database. "empty" keeps configuration but no traffic, like `reset` with an empty seed. */
export function createMockDatabase(mockDataSize: MockDataSize): MockDatabase {
  seedFixtureRandomness();
  const configuration = buildConfiguration();

  if (mockDataSize === "empty") {
    return {
      ...configuration,
      emails: [],
      emailTimelines: new Map(),
      attachmentContents: new Map(),
      smsMediaContents: new Map(),
      smsMessages: [],
      verifications: [],
      webhookDeliveries: [],
      capturedHttpRequests: [],
      httpFileContents: new Map(),
      payments: [],
      smtpSessions: [],
      apiRequestLog: [],
    };
  }

  const emailFixtures =
    mockDataSize === "large"
      ? buildLargeEmailFixtures(largeDataSetEmailCount)
      : buildStandardEmailFixtures();
  const smsMessages = sortNewestFirst(buildStandardSmsFixtures());
  const emails = sortNewestFirst(
    emailFixtures.map((emailFixture) => emailFixture.email),
  );
  const smtpSessions = buildSmtpSessionFixtures(emails);
  const apiRequestLog = buildApiRequestLogFixtures(
    mockDataSize === "large" ? largeDataSetApiRequestCount : 0,
  );
  linkApiRequestFixtures(apiRequestLog, emails, smsMessages);
  const webhookDeliveries = linkDeliverySubjects(
    buildWebhookDeliveryFixtures(configuration.webhookEndpoints),
    emails.map((email) => email.id),
    smsMessages.map((smsMessage) => smsMessage.id),
  );
  // Payment notifications are deliveries too, added to the same log.
  const payments = buildPaymentFixtures({
    webhookEndpoints: configuration.webhookEndpoints,
    webhookDeliveries,
  });
  const httpCatcherTraffic = buildHttpCatcherTraffic(
    configuration.httpBins,
    configuration.httpResponseRules,
    configuration.webhookVariables,
  );

  return {
    ...configuration,
    emails,
    attachmentContents: new Map(),
    smsMediaContents: new Map(),
    emailTimelines: new Map(
      emailFixtures.map((emailFixture) => [
        emailFixture.email.id,
        emailFixture.timeline,
      ]),
    ),
    smsMessages,
    verifications: linkVerificationMessages(
      buildVerificationFixtures(configuration.verifyServices),
      smsMessages,
    ),
    webhookDeliveries: sortNewestFirst(webhookDeliveries),
    payments: sortNewestFirst(payments),
    httpBins: httpCatcherTraffic.httpBins,
    capturedHttpRequests: sortNewestFirst(httpCatcherTraffic.capturedRequests),
    httpFileContents: httpCatcherTraffic.fileContents,
    smtpSessions,
    apiRequestLog,
  };
}

/** The single shared instance used by every mock handler. */
export let mockDatabase: MockDatabase = createMockDatabase("standard");

export function replaceMockDatabase(mockDataSize: MockDataSize) {
  mockDatabase = createMockDatabase(mockDataSize);
}

/** A template's request shape: a custom one from the database, else the fixtures. */
export function findTemplateDefinition(
  database: MockDatabase,
  templateId: string,
): TemplateDefinition {
  return (
    database.customTemplateDefinitions.get(templateId) ??
    readTemplateDefinition(templateId)
  );
}
