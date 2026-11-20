import { getResponse, HttpHandler } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import type {
  SavedScenario,
  ScenarioReport,
  SetupValidation,
} from "@/lib/api/types";
import { registerMockRequestHandlers } from "@/mocks/automation/mock-request-dispatcher";
import { replaceMockDatabase } from "@/mocks/db/mock-database";
import { mockHandlers } from "@/mocks/handlers";

const httpHandlers = mockHandlers.filter(
  (mockHandler): mockHandler is HttpHandler =>
    mockHandler instanceof HttpHandler,
);

const sampleScenario =
  '[[steps]]\nrun = "sample.send"\nwith = { kind = "sms" }\n';

async function callApi(
  method: string,
  path: string,
  requestBody?: unknown,
): Promise<Response> {
  const response = await getResponse(
    httpHandlers,
    new Request(`http://localhost/api/v1${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
    }),
  );
  if (response === undefined) {
    throw new Error(`No mock handler for ${method} ${path}`);
  }

  return response;
}

async function exportSetup(exportRequest: object): Promise<string> {
  const response = await callApi("POST", "/setup/export", exportRequest);
  expect(response.status).toBe(200);

  return response.text();
}

beforeEach(() => {
  replaceMockDatabase("standard");
  registerMockRequestHandlers(httpHandlers);
});

describe("setup export, validate, import and migrate", () => {
  test("PL-18.1 an export starts with the versioned header and names its format", async () => {
    const response = await callApi("POST", "/setup/export", {
      format: "json",
    });
    const setupDocument = (await response.json()) as {
      sendmock: { format: string; format_version: number };
    };

    expect(response.headers.get("content-disposition")).toContain(
      "sendmock.setup.json",
    );
    expect(setupDocument.sendmock.format).toBe("sendmock.setup");
    expect(setupDocument.sendmock.format_version).toBe(2);
  });

  test("PL-18.5 only and except pick the sections, in TOML, JSON and YAML", async () => {
    const numbersOnly = await exportSetup({ only: ["numbers"] });
    const withoutSettings = await exportSetup({
      format: "yaml",
      except: ["settings"],
    });

    expect(numbersOnly).toContain("[[numbers]]");
    expect(numbersOnly).not.toContain("[settings]");
    expect(withoutSettings).toContain("numbers:");
    expect(withoutSettings).not.toContain("settings:");
  });

  test("PL-18.6 secrets are encrypted only with a passphrase of 8 characters or more", async () => {
    const shortPassphrase = await callApi("POST", "/setup/export", {
      include_secrets: true,
      passphrase: "short",
    });
    const encryptedSetup = await exportSetup({
      include_secrets: true,
      passphrase: "correct horse battery",
    });

    expect(shortPassphrase.status).toBe(400);
    expect(encryptedSetup).toContain("encrypted:v1:");
    expect(encryptedSetup).not.toContain("${");
  });

  test("PL-18.8 validating an export of the same mock lists no change", async () => {
    const setupText = await exportSetup({});

    const response = await callApi("POST", "/setup/validate", {
      setup_text: setupText,
      mode: "replace",
    });
    const setupValidation = (await response.json()) as SetupValidation;

    expect(setupValidation.is_valid).toBe(true);
    expect(setupValidation.changes).toEqual([]);
  });

  test("PL-18.8 a replace that removes items needs the removed count", async () => {
    const setupText = '[[numbers]]\nnumber = "+15559990001"\nlabel = "Only"\n';
    const preview = (await (
      await callApi("POST", "/setup/validate", {
        setup_text: setupText,
        mode: "replace",
      })
    ).json()) as SetupValidation;

    const unconfirmed = await callApi("POST", "/setup/import", {
      setup_text: setupText,
      mode: "replace",
    });
    const confirmed = await callApi("POST", "/setup/import", {
      setup_text: setupText,
      mode: "replace",
      confirm_removed_count: preview.removed_count,
    });

    expect(preview.removed_count).toBeGreaterThan(0);
    expect(unconfirmed.status).toBe(422);
    expect(confirmed.status).toBe(200);
  });

  test("PL-18.4 a newer format is refused", async () => {
    const response = await callApi("POST", "/setup/import", {
      setup_text:
        '[sendmock]\nformat = "sendmock.setup"\nformat_version = 99\n',
    });

    expect(response.status).toBe(422);
  });

  test("PL-18.3 migrate writes the copy with the current header", async () => {
    const response = await callApi("POST", "/setup/migrate", {
      setup_text: '[[numbers]]\nnumber = "+15559990002"\nlabel = "Old"\n',
      to_format: "json",
    });
    const migratedDocument = (await response.json()) as {
      sendmock: { format_version: number };
    };

    expect(migratedDocument.sendmock.format_version).toBe(2);
  });
});

describe("saved scenarios", () => {
  test("AI-07.1 a scenario is saved, read by name, renamed and deleted", async () => {
    const created = await callApi("POST", "/scenarios", {
      name: "otp-login",
      scenario: sampleScenario,
    });
    const duplicate = await callApi("POST", "/scenarios", {
      name: "otp-login",
      scenario: sampleScenario,
    });
    const renamed = (await (
      await callApi("PATCH", "/scenarios/otp-login", { name: "sms-login" })
    ).json()) as SavedScenario;
    const deleted = await callApi("DELETE", "/scenarios/sms-login");
    const savedScenarios = (await (
      await callApi("GET", "/scenarios")
    ).json()) as SavedScenario[];

    expect(created.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect(renamed.name).toBe("sms-login");
    expect(deleted.status).toBe(204);
    expect(savedScenarios).toEqual([]);
  });

  test("AI-07.2 a saved scenario runs and answers the same report", async () => {
    await callApi("POST", "/scenarios", {
      name: "send-sms",
      scenario: sampleScenario,
    });

    const scenarioReport = (await (
      await callApi("POST", "/scenarios/send-sms/run")
    ).json()) as ScenarioReport;

    expect(scenarioReport.steps).toHaveLength(1);
  });

  test("AI-07.1 an invalid scenario is refused on save", async () => {
    const response = await callApi("POST", "/scenarios", {
      name: "broken",
      scenario: '[[steps]]\nrun = "rocket.launch"\n',
    });

    expect(response.status).toBe(422);
  });
});
