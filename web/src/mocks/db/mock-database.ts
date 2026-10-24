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
  Verification,
  VerifyService,
  VirtualNumber,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookRule,
  WebhookTemplateSummary,
  WebhookVariable,
} from "@/lib/api/types";
import {
  buildApiRequestLogFixtures,
  buildCapturedHttpRequestFixtures,
  buildDefaultSettings,
  buildHttpBinFixtures,
  buildSmtpSessionFixtures,
} from "@/mocks/fixtures/catcher-and-log-fixtures";
import {
  buildLargeEmailFixtures,
  buildStandardEmailFixtures,
} from "@/mocks/fixtures/email-fixtures";
import { seedFixtureRandomness } from "@/mocks/fixtures/fixture-helpers";
import { buildStandardSmsFixtures } from "@/mocks/fixtures/sms-fixtures";
import {
  buildSavedDeliveryFixtures,
  buildWebhookTemplateFixtures,
  buildWebhookVariableFixtures,
} from "@/mocks/fixtures/template-and-variable-fixtures";
import {
  buildMessagingServiceFixtures,
  buildVerificationFixtures,
  buildVerifyServiceFixtures,
  buildVirtualNumberFixtures,
} from "@/mocks/fixtures/verify-and-number-fixtures";
import {
  buildWebhookDeliveryFixtures,
  buildWebhookEndpointFixtures,
  buildWebhookRuleFixtures,
} from "@/mocks/fixtures/webhook-fixtures";

/** In-memory state behind the mock API. Lists are kept newest first. */
export type MockDatabase = {
  emails: EmailDetail[];
  emailTimelines: Map<string, EmailTimelineEntry[]>;
  smsMessages: SmsMessageDetail[];
  verifyServices: VerifyService[];
  verifications: Verification[];
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

  return {
    ...configuration,
    emails: sortNewestFirst(
      emailFixtures.map((emailFixture) => emailFixture.email),
    ),
    emailTimelines: new Map(
      emailFixtures.map((emailFixture) => [
        emailFixture.email.id,
        emailFixture.timeline,
      ]),
    ),
    smsMessages: sortNewestFirst(buildStandardSmsFixtures()),
    verifications: buildVerificationFixtures(configuration.verifyServices),
    webhookDeliveries: sortNewestFirst(
      buildWebhookDeliveryFixtures(configuration.webhookEndpoints),
    ),
    capturedHttpRequests: sortNewestFirst(
      buildCapturedHttpRequestFixtures(configuration.httpBins),
    ),
    smtpSessions: buildSmtpSessionFixtures(),
    apiRequestLog: buildApiRequestLogFixtures(),
  };
}

/** The single shared instance used by every mock handler. */
export let mockDatabase: MockDatabase = createMockDatabase("standard");

export function replaceMockDatabase(mockDataSize: MockDataSize) {
  mockDatabase = createMockDatabase(mockDataSize);
}
