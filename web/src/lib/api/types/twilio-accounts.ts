import type { CreatedBy, IsoTimestamp } from "@/lib/api/types/common";

/** A Twilio account's status, as the Accounts API writes it. */
export type TwilioAccountStatus = "active" | "suspended" | "closed";

/** A subaccount of the Twilio provider's main account; its auth token is masked. */
export type TwilioSubaccount = {
  /**
   * The subaccount SID, `AC` and 32 hex digits.
   * @example "AC22222222222222222222222222222222"
   */
  account_sid: string;
  /**
   * A name for the subaccount, e.g. the customer it belongs to.
   * @example "Acme Clinic"
   */
  friendly_name: string;
  /**
   * `active`, `suspended` or `closed`; a send under a suspended or closed subaccount is refused.
   * @example "active"
   */
  status: TwilioAccountStatus;
  /**
   * `••••` and the last four characters; reveal it with the CLI or the provider sheet.
   * @example "••••9f2c"
   */
  auth_token: string;
  /**
   * Where Twilio Debugger events for this subaccount are sent; null for none.
   * @example "https://shop.test/twilio/debugger"
   */
  debugger_url: string | null;
  created_by: CreatedBy;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
};

/** Body of `PATCH /api/v1/twilio/subaccounts/{accountSid}`. */
export type TwilioSubaccountChanges = {
  /**
   * A name for the subaccount.
   * @example "Acme Clinic"
   */
  friendly_name: string;
  /**
   * Defaults to `active`.
   * @example "active"
   */
  status?: TwilioAccountStatus;
  /**
   * The subaccount's auth token. Null, empty or the masked value keeps the stored token; a new subaccount without one gets a generated token.
   * @example null
   */
  auth_token?: string | null;
  /**
   * Where Twilio Debugger events for this subaccount are sent; null for none.
   * @example null
   */
  debugger_url?: string | null;
};

/** Body of `POST /api/v1/twilio/subaccounts`. */
export type TwilioSubaccountInput = TwilioSubaccountChanges & {
  /**
   * `AC` and 32 hex digits; null makes a new one.
   * @example null
   */
  account_sid?: string | null;
};

/** A subaccount's auth token, shown in full after a confirmation. */
export type TwilioSubaccountTokenReveal = {
  /** @example "AC22222222222222222222222222222222" */
  account_sid: string;
  /** @example "example-subaccount-token-9f2c" */
  auth_token: string;
};
