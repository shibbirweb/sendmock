import type { IsoTimestamp, Ulid } from "@/lib/api/types/common";

/** Where a provider lives: email and SMS providers (Verify services among them), push services and payment gateways. */
export type ProviderArea = "email" | "sms" | "push" | "payments";

/** An HTTP Catcher bin attached to a provider (PL-21): requests on its base URL that no built-in operation answers are captured there and answered by the bin's rules. */
export type ProviderBin = {
  /**
   * The provider's area.
   * @example "sms"
   */
  area: ProviderArea;
  /**
   * The provider's key.
   * @example "twilio"
   */
  provider_key: string;
  /**
   * The attached bin's ID.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  bin_id: Ulid;
  /**
   * The attached bin's name.
   * @example "twilio-gaps"
   */
  bin_name: string;
  attached_at: IsoTimestamp;
};

/** Body of `PUT /api/v1/provider-bins/{area}/{providerKey}`. */
export type ProviderBinAttachment = {
  /**
   * The bin's name; a bin of that name is made when there is none.
   * @example "twilio-gaps"
   */
  bin_name: string;
};
