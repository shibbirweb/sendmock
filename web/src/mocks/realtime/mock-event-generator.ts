import { faker } from "@faker-js/faker/locale/en";

import {
  readMockConditions,
  subscribeToMockConditions,
} from "@/mocks/conditions/mock-conditions";
import { mockDatabase } from "@/mocks/db/mock-database";
import { buildEmailFixture } from "@/mocks/fixtures/email-fixture-builder";
import { buildNewSmsMessage } from "@/mocks/fixtures/sms-message-builder";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import { simulateSmsDelivery } from "@/mocks/realtime/simulate-sms-delivery";

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

/** Adds one new outbound SMS, announces it and moves it towards delivered. */
export function generateSampleSms() {
  const outboundMessage = buildNewSmsMessage({
    direction: "outbound",
    channel: "sms",
    api: "twilio",
    fromNumber: "+15550001111",
    toNumber: `+88017${faker.string.numeric(8)}`,
    body: `Your Acme code is ${faker.string.numeric(6)}`,
  });

  mockDatabase.smsMessages.unshift(outboundMessage);
  publishMockEvent("sms.sent", {
    id: outboundMessage.id,
    to_number: outboundMessage.to_number,
    body: outboundMessage.body,
  });
  simulateSmsDelivery(outboundMessage);
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
