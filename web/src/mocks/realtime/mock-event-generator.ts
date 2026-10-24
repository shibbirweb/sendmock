import { faker } from "@faker-js/faker";

import { calculateSmsSegments } from "@/lib/sms/calculate-sms-segments";
import {
  readMockConditions,
  subscribeToMockConditions,
} from "@/mocks/conditions/mock-conditions";
import { mockDatabase } from "@/mocks/db/mock-database";
import { buildEmailFixture } from "@/mocks/fixtures/email-fixture-builder";
import {
  createMockUlid,
  createProviderId,
  extractFixtureData,
} from "@/mocks/fixtures/fixture-helpers";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

/** Adds one new email and announces it, like an app sending over SMTP. */
export function generateSampleEmail() {
  const otpCode = faker.string.numeric(6);
  const emailFixture = buildEmailFixture({
    minutesAgo: 0,
    from: { name: "Acme App", address: "no-reply@acme.test" },
    to: [
      {
        name: faker.person.fullName(),
        address: faker.internet
          .email({ provider: "example.com" })
          .toLowerCase(),
      },
    ],
    subject: faker.helpers.arrayElement([
      "Your verification code",
      "Welcome to Acme",
      `Order #${faker.string.numeric(5)} confirmed`,
    ]),
    textBody: `Hello! Your verification code is ${otpCode}. Thanks for using Acme.`,
  });

  mockDatabase.emails.unshift(emailFixture.email);
  mockDatabase.emailTimelines.set(emailFixture.email.id, emailFixture.timeline);
  publishMockEvent("email.received", {
    id: emailFixture.email.id,
    subject: emailFixture.email.subject,
    from: emailFixture.email.from,
  });
}

/** Adds one new outbound SMS and announces it. */
export function generateSampleSms() {
  const messageBody = `Your Acme code is ${faker.string.numeric(6)}`;
  const segmentInfo = calculateSmsSegments(messageBody);
  const createdAt = new Date().toISOString();
  const toNumber = `+88017${faker.string.numeric(8)}`;

  mockDatabase.smsMessages.unshift({
    id: createMockUlid(),
    provider_id: createProviderId("SM"),
    direction: "outbound",
    channel: "sms",
    api: "twilio",
    from_number: "+15550001111",
    to_number: toNumber,
    body: messageBody,
    encoding: segmentInfo.encoding,
    segments: segmentInfo.segmentCount,
    media_urls: [],
    status: "delivered",
    error_code: null,
    status_callback_url: null,
    messaging_service_sid: null,
    account: "AC00000000000000000000000000000000",
    extracted: extractFixtureData(messageBody),
    opened_at: null,
    open_count: 0,
    created_at: createdAt,
    updated_at: createdAt,
    status_history: [{ status: "delivered", at: createdAt, error_code: null }],
    request_body: { To: toNumber, Body: messageBody },
    api_request_id: null,
  });
  publishMockEvent("sms.sent", { to_number: toNumber, body: messageBody });
}

const trafficGenerators = [generateSampleEmail, generateSampleSms];
let generatorTimer: ReturnType<typeof setInterval> | null = null;

function restartGenerator() {
  if (generatorTimer !== null) {
    clearInterval(generatorTimer);
    generatorTimer = null;
  }

  const mockConditions = readMockConditions();
  if (
    !mockConditions.isRealtimeEnabled ||
    mockConditions.dataSize === "empty"
  ) {
    return;
  }

  generatorTimer = setInterval(() => {
    faker.helpers.arrayElement(trafficGenerators)();
  }, mockConditions.realtimeIntervalMs);
}

/** Simulates live traffic so realtime updates can be seen without a backend. */
export function startMockEventGenerator() {
  restartGenerator();
  subscribeToMockConditions(restartGenerator);
}
