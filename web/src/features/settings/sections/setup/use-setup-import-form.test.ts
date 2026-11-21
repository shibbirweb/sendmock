import { describe, expect, test } from "vitest";

import {
  buildImportRequest,
  type SetupImportFields,
} from "@/features/settings/sections/setup/use-setup-import-form";

const importFields: SetupImportFields = {
  sourceKind: "text",
  setupText: '[[numbers]]\nnumber = "+15550001111"',
  url: "https://example.com/sendmock.setup.toml",
  sha256: "",
  headerLines: "Authorization: Bearer secret\n\n  X-Team: qa  ",
  importMode: "replace",
  passphrase: "",
};

describe("buildImportRequest", () => {
  test("PL-18.7 pasted text sends only the text, the mode and no passphrase", () => {
    expect(buildImportRequest(importFields)).toEqual({
      setup_text: importFields.setupText,
      url: null,
      sha256: null,
      headers: [],
      mode: "replace",
      passphrase: null,
    });
  });

  test("PL-18.7 a URL sends its checksum and one header per non-empty line", () => {
    const importRequest = buildImportRequest({
      ...importFields,
      sourceKind: "url",
      sha256: " ABC123 ",
      passphrase: "correct horse battery",
    });

    expect(importRequest.setup_text).toBeNull();
    expect(importRequest.url).toBe(importFields.url);
    expect(importRequest.sha256).toBe("ABC123");
    expect(importRequest.headers).toEqual([
      "Authorization: Bearer secret",
      "X-Team: qa",
    ]);
    expect(importRequest.passphrase).toBe("correct horse battery");
  });
});
