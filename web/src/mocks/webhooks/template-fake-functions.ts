import { faker } from "@faker-js/faker/locale/en";

import type { TemplateReferenceHelper } from "@/lib/api/types";

/** Test domains only, so a fake address never reaches a real mailbox or site. */
const fakeDomains = ["example.com", "example.org", "example.test"];

function pickFakeDomain(): string {
  return faker.helpers.arrayElement(fakeDomains);
}

/** `fake.*()` and `lorem()` as the binary answers them (WH-07.3). */
export const fakeTemplateFunctions: Record<
  string,
  (argumentTexts: string[]) => string
> = {
  "fake.name": () => faker.person.fullName(),
  "fake.first_name": () => faker.person.firstName(),
  "fake.last_name": () => faker.person.lastName(),
  "fake.email": () =>
    faker.internet.email({ provider: pickFakeDomain() }).toLowerCase(),
  "fake.username": () => faker.internet.username().toLowerCase(),
  "fake.company": () => faker.company.name(),
  "fake.sentence": () => faker.lorem.sentence(),
  "fake.paragraph": () => faker.lorem.paragraph(),
  "fake.word": () => faker.lorem.word(),
  "fake.address": () =>
    `${faker.location.streetAddress()}, ${faker.location.city()}`,
  "fake.city": () => faker.location.city(),
  "fake.country_code": () => faker.location.countryCode(),
  "fake.ip": () => `203.0.113.${faker.number.int({ min: 1, max: 254 })}`,
  "fake.user_agent": () => faker.internet.userAgent(),
  "fake.url": () => `https://${pickFakeDomain()}/${faker.lorem.word()}`,
  lorem: ([wordCountText]) => faker.lorem.words(Number(wordCountText) || 8),
};

const fakeFunctionDescriptions: Record<string, [string, string]> = {
  "fake.name": ["A fake full name.", "Maya Novak"],
  "fake.first_name": ["A fake first name.", "Maya"],
  "fake.last_name": ["A fake last name.", "Novak"],
  "fake.email": [
    "A fake email address at a test domain.",
    "maya.novak42@example.com",
  ],
  "fake.username": ["A fake username.", "maya.novak42"],
  "fake.company": ["A fake company name.", "Northwind Labs"],
  "fake.sentence": ["A lorem sentence.", "Lorem ipsum dolor sit amet."],
  "fake.paragraph": [
    "A few lorem sentences.",
    "Lorem ipsum dolor sit amet. Sed do eiusmod tempor.",
  ],
  "fake.word": ["One lorem word.", "dolor"],
  "fake.address": ["A fake street address and city.", "12 Lake Road, Lisbon"],
  "fake.city": ["A fake city.", "Oslo"],
  "fake.country_code": ["A two-letter country code.", "BD"],
  "fake.ip": ["An IPv4 address from the documentation range.", "203.0.113.7"],
  "fake.user_agent": [
    "A browser user agent.",
    "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
  ],
  "fake.url": ["A URL at a test domain.", "https://example.org/ipsum"],
};

/** The reference entries of the fake functions and `lorem`. */
export const fakeFunctionCatalog: TemplateReferenceHelper[] = [
  ...Object.entries(fakeFunctionDescriptions).map(
    ([functionName, [description, example]]) => ({
      name: functionName,
      signature: `${functionName}()`,
      description,
      example,
    }),
  ),
  {
    name: "lorem",
    signature: "lorem(words)",
    description: "Placeholder text of the given number of words.",
    example: "lorem ipsum dolor",
  },
];

/** Postman's dynamic variables and the SendMock expression each becomes. */
const postmanAliases: Record<string, string> = {
  guid: "uuid()",
  randomUUID: "uuid()",
  timestamp: "now_unix()",
  isoTimestamp: "now_iso()",
  randomEmail: "fake.email()",
  randomExampleEmail: "fake.email()",
  randomUserName: "fake.username()",
  randomFirstName: "fake.first_name()",
  randomLastName: "fake.last_name()",
  randomFullName: "fake.name()",
  randomCompanyName: "fake.company()",
  randomCity: "fake.city()",
  randomStreetAddress: "fake.address()",
  randomCountryCode: "fake.country_code()",
  randomIP: "fake.ip()",
  randomUserAgent: "fake.user_agent()",
  randomUrl: "fake.url()",
  randomWord: "fake.word()",
  randomLoremWord: "fake.word()",
  randomLoremSentence: "fake.sentence()",
  randomLoremParagraph: "fake.paragraph()",
};

/** `{{$randomUUID}}` and the other known aliases rewritten before rendering. */
export function rewritePostmanAliases(templateText: string): string {
  return templateText.replace(
    /\{\{\s*\$([A-Za-z]+)\s*\}\}/g,
    (aliasText: string, aliasName: string) => {
      const expression = postmanAliases[aliasName];
      return expression === undefined ? aliasText : `{{ ${expression} }}`;
    },
  );
}
