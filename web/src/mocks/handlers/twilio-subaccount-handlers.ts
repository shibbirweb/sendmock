import { http, HttpResponse } from "msw";

import type {
  TwilioSubaccount,
  TwilioSubaccountChanges,
  TwilioSubaccountInput,
} from "@/lib/api/types";
import {
  mockDatabase,
  type MockTwilioSubaccount,
} from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { maskSecretValue } from "@/mocks/payments/render-gateway-templates";

const accountSidPattern = /^AC[0-9a-fA-F]{32}$/;

function createHex32(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}

function describeSubaccount(
  subaccount: MockTwilioSubaccount,
): TwilioSubaccount {
  return { ...subaccount, auth_token: maskSecretValue(subaccount.auth_token) };
}

function findSubaccount(accountSid: unknown): MockTwilioSubaccount | undefined {
  return mockDatabase.twilioSubaccounts.find(
    (subaccount) => subaccount.account_sid === accountSid,
  );
}

/** A token sent back empty or masked keeps the stored one, as the server does. */
function readChangedToken(
  changes: TwilioSubaccountChanges,
  storedToken: string | undefined,
): string {
  const sentToken = changes.auth_token?.trim() ?? "";
  if (storedToken !== undefined) {
    const isUnchanged =
      sentToken === "" || sentToken === maskSecretValue(storedToken);
    return isUnchanged ? storedToken : sentToken;
  }
  return sentToken === "" ? createHex32() : sentToken;
}

function validateChanges(changes: TwilioSubaccountChanges): string | null {
  if (changes.friendly_name.trim() === "") {
    return "Enter a name";
  }
  const debuggerUrl = changes.debugger_url?.trim() ?? "";
  if (debuggerUrl !== "" && !/^https?:\/\/\S+$/i.test(debuggerUrl)) {
    return "Enter an http or https URL";
  }
  return null;
}

/** Subaccounts of the Twilio provider's main account (SM-19). */
export const twilioSubaccountHandlers = [
  http.get("*/api/v1/twilio/subaccounts", async () => {
    await applyMockConditions();

    return HttpResponse.json(
      mockDatabase.twilioSubaccounts.map(describeSubaccount),
    );
  }),

  http.post("*/api/v1/twilio/subaccounts", async ({ request }) => {
    await applyMockConditions();
    const subaccountInput = (await request.json()) as TwilioSubaccountInput;
    const validationError = validateChanges(subaccountInput);
    if (validationError !== null) {
      return createErrorResponse(400, "validation_failed", validationError);
    }
    const requestedSid = subaccountInput.account_sid?.trim() ?? "";
    if (requestedSid !== "" && !accountSidPattern.test(requestedSid)) {
      return createErrorResponse(
        400,
        "validation_failed",
        "An account SID is AC and 32 hex digits",
      );
    }
    const accountSid =
      requestedSid === "" ? `AC${createHex32()}` : requestedSid;
    if (findSubaccount(accountSid) !== undefined) {
      return createErrorResponse(
        409,
        "account_exists",
        `A Twilio account with SID ${accountSid} already exists`,
      );
    }
    const now = new Date().toISOString();
    const subaccount: MockTwilioSubaccount = {
      account_sid: accountSid,
      friendly_name: subaccountInput.friendly_name.trim(),
      status: subaccountInput.status ?? "active",
      auth_token: readChangedToken(subaccountInput, undefined),
      debugger_url: subaccountInput.debugger_url?.trim() || null,
      created_by: "ui",
      created_at: now,
      updated_at: now,
    };
    mockDatabase.twilioSubaccounts.push(subaccount);

    return HttpResponse.json(describeSubaccount(subaccount), { status: 201 });
  }),

  http.patch(
    "*/api/v1/twilio/subaccounts/:accountSid",
    async ({ params, request }) => {
      await applyMockConditions();
      const subaccount = findSubaccount(params.accountSid);
      if (subaccount === undefined) {
        return createNotFoundResponse("Twilio subaccount");
      }
      const changes = (await request.json()) as TwilioSubaccountChanges;
      const validationError = validateChanges(changes);
      if (validationError !== null) {
        return createErrorResponse(400, "validation_failed", validationError);
      }
      Object.assign(subaccount, {
        friendly_name: changes.friendly_name.trim(),
        status: changes.status ?? "active",
        auth_token: readChangedToken(changes, subaccount.auth_token),
        debugger_url: changes.debugger_url?.trim() || null,
        updated_at: new Date().toISOString(),
      });

      return HttpResponse.json(describeSubaccount(subaccount));
    },
  ),

  http.delete("*/api/v1/twilio/subaccounts/:accountSid", async ({ params }) => {
    await applyMockConditions();
    mockDatabase.twilioSubaccounts = mockDatabase.twilioSubaccounts.filter(
      (subaccount) => subaccount.account_sid !== params.accountSid,
    );

    return new HttpResponse(null, { status: 204 });
  }),

  http.get(
    "*/api/v1/twilio/subaccounts/:accountSid/auth-token",
    async ({ params }) => {
      await applyMockConditions();
      const subaccount = findSubaccount(params.accountSid);

      return subaccount === undefined
        ? createNotFoundResponse("Twilio subaccount")
        : HttpResponse.json({
            account_sid: subaccount.account_sid,
            auth_token: subaccount.auth_token,
          });
    },
  ),
];
