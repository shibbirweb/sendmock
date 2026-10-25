import type {
  ApiRequestLogEntry,
  AppSettings,
  CapturedHttpRequest,
  EmailDetail,
  EmailTimelineEntry,
  HttpBin,
  MessagingService,
  SavedDelivery,
  SmsMessageDetail,
  SmtpSession,
  VerificationDetail,
  VerifyService,
  VirtualNumber,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookRule,
  WebhookTemplateSummary,
  WebhookVariable,
} from "@/lib/api/types";
import {
  buildCapturedHttpRequestFixtures,
  buildDefaultSettings,
  buildHttpBinFixtures,
} from "@/mocks/fixtures/catcher-and-log-fixtures";
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
  buildWebhookDeliveryFixtures,
  buildWebhookEndpointFixtures,
  buildWebhookRuleFixtures,
} from "@/mocks/fixtures/webhook-fixtures";

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
  webhookEndpoints: WebhookEndpoint[];
  webhookRules: WebhookRule[];
  webhookDeliveries: WebhookDelivery[];
  webhookTemplates: WebhookTemplateSummary[];
  webhookVariables: WebhookVariable[];
  savedDeliveries: SavedDelivery[];
  httpBins: HttpBin[];
  capturedHttpRequests: CapturedHttpRequest[];
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

  return {
    virtualNumbers,
    messagingServices: buildMessagingServiceFixtures(virtualNumbers),
    verifyServices,
    webhookEndpoints,
    webhookRules: buildWebhookRuleFixtures(webhookEndpoints),
    webhookTemplates: buildWebhookTemplateFixtures(),
    webhookVariables: buildWebhookVariableFixtures(),
    savedDeliveries: buildSavedDeliveryFixtures(),
    httpBins,
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
      smtpSessions: [],
      apiRequestLog: [],
      httpBins: configuration.httpBins.map((httpBin) => ({
        ...httpBin,
        request_count: 0,
        last_request_at: null,
      })),
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
    webhookDeliveries: sortNewestFirst(
      buildWebhookDeliveryFixtures(configuration.webhookEndpoints),
    ),
    capturedHttpRequests: sortNewestFirst(
      buildCapturedHttpRequestFixtures(configuration.httpBins),
    ),
    smtpSessions,
    apiRequestLog,
  };
}

/** The single shared instance used by every mock handler. */
export let mockDatabase: MockDatabase = createMockDatabase("standard");

export function replaceMockDatabase(mockDataSize: MockDataSize) {
  mockDatabase = createMockDatabase(mockDataSize);
}
