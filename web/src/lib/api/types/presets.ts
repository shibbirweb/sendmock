import type { SeedItemCount } from "@/lib/api/types/system";

/** One option of a stack preset, with the value used when it is left out (PL-27). */
export type PresetOptionView = {
  /**
   * The option's name, as the apply body's `options` takes it.
   * @example "mailgun_events_path"
   */
  name: string;
  /**
   * The value used when the option is left out.
   * @example "/webhooks/mailgun/events"
   */
  default_value: string;
  description: string;
};

/** A stack preset, as `GET /presets` lists it. */
export type StackPreset = {
  /**
   * The preset's name.
   * @example "laravel-mailgun-twilio"
   */
  name: string;
  description: string;
  options: PresetOptionView[];
};

/** Body of `POST /presets/{presetName}/apply`. */
export type PresetApplyInput = {
  /**
   * Where SendMock reaches your app.
   * @example "http://localhost:8000"
   */
  app_url: string;
  /**
   * The preset's options by name (its webhook paths); left out, their defaults.
   * @example {"mailgun_events_path": "/webhooks/mailgun/events"}
   */
  options?: Record<string, string>;
  /**
   * Numbers to add, one per line: `number,label,subaccount_sid,messaging_service_sid` (a first line starting with `number` is a header).
   * @example "+15550001111,Clinic line,AC22222222222222222222222222222222,"
   */
  numbers_csv?: string | null;
};

/** What applying a preset did, and what your app needs. */
export type PresetApplyResult = {
  /**
   * The preset applied.
   * @example "laravel-mailgun-twilio"
   */
  preset_name: string;
  /** The items its setup file created or updated, by kind. */
  applied: SeedItemCount[];
  /**
   * What else it did: the signing key, the Debugger URL, the numbers.
   * @example ["Made the Mailgun signing key."]
   */
  steps: string[];
  /**
   * The SMTP address of this SendMock.
   * @example "127.0.0.1:1025"
   */
  smtp_address: string;
  /**
   * The provider port; null when it is off.
   * @example "127.0.0.1:8026"
   */
  provider_address: string | null;
  /**
   * The HTTPS provider port; null when it is off.
   * @example null
   */
  provider_tls_address: string | null;
  /**
   * What to fix, such as an HTTPS provider port that is off.
   * @example []
   */
  warnings: string[];
  /**
   * The lines for your app's `.env`; secrets are hidden from AI agents.
   * @example "MAIL_MAILER=mailgun\nMAILGUN_DOMAIN=mg.example.test"
   */
  env_block: string;
};
