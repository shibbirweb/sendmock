import { faker } from "@faker-js/faker/locale/en";

import type { ExtractedData } from "@/lib/api/types";

const crockfordBase32Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A ULID-shaped ID whose first 10 characters sort by creation time. */
export function createMockUlid(createdAtMs: number = Date.now()): string {
  let timePart = "";
  let remainingTime = createdAtMs;

  for (let characterIndex = 0; characterIndex < 10; characterIndex += 1) {
    timePart = crockfordBase32Alphabet[remainingTime % 32] + timePart;
    remainingTime = Math.floor(remainingTime / 32);
  }

  const randomPart = faker.string.fromCharacters(crockfordBase32Alphabet, 16);

  return timePart + randomPart;
}

/** Provider-style ID, e.g. "SM" + 32 hex characters for Twilio messages. */
export function createProviderId(prefix: string): string {
  return (
    prefix + faker.string.hexadecimal({ length: 32, prefix: "" }).toLowerCase()
  );
}

export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function minutesAgoInMs(minutes: number): number {
  return Date.now() - minutes * 60_000;
}

const otpPattern =
  /(?:code|otp|verification|pin|passcode)[^0-9]{0,40}(\d{4,8})|(\d{4,8})[^0-9]{0,20}(?:is your|is the)/gi;
const linkPattern = /https?:\/\/[^\s"'<>)]+/gi;

/** Same extraction rules as the backend will use (EM-05), simplified for fixtures. */
export function extractFixtureData(messageText: string): ExtractedData {
  const otpCodes = new Set<string>();

  for (const otpMatch of messageText.matchAll(otpPattern)) {
    const otpCode = otpMatch[1] ?? otpMatch[2];
    if (otpCode !== undefined) {
      otpCodes.add(otpCode);
    }
  }

  return {
    otp: [...otpCodes],
    links: [...new Set(messageText.match(linkPattern) ?? [])],
  };
}

/** Makes faker output identical on every page load, so screenshots stay stable. */
export function seedFixtureRandomness() {
  faker.seed(2026);
}
