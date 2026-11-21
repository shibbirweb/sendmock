import { describe, expect, test } from "vitest";

import { toProviderBinName } from "@/features/http/provider-bins/to-provider-bin-name";

describe("toProviderBinName", () => {
  test("PL-21.1 a provider's new bin is named after its key", () => {
    expect(toProviderBinName("twilio")).toBe("twilio-gaps");
    expect(toProviderBinName("Acme Voice")).toBe("acme-voice-gaps");
    expect(toProviderBinName("__")).toBe("provider-gaps");
  });
});
