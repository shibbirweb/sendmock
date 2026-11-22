import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const httpsPage = readFileSync("docs/wiki/connect/https.md", "utf8");

describe("HTTPS for provider SDKs docs", () => {
  test("PL-20.4 the page gives numbered steps to trust the CA on each system and runtime", () => {
    for (const heading of [
      "On macOS:",
      "On Windows (PowerShell as administrator):",
      "On Debian and Ubuntu:",
      "On Fedora and RHEL:",
      "## Trust it in Docker",
    ]) {
      expect(httpsPage).toContain(heading);
    }
    for (const runtimeSetting of [
      "openssl.cafile",
      "NODE_EXTRA_CA_CERTS",
      "REQUESTS_CA_BUNDLE",
      "SSL_CERT_FILE",
      "keytool -importcert",
      "**.NET:**",
    ]) {
      expect(httpsPage).toContain(runtimeSetting);
    }
    expect(httpsPage).toContain(
      "1. Start SendMock with the HTTPS provider port",
    );
    expect(httpsPage).toContain("provider_tls_address");
  });
});
