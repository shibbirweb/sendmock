import { describe, expect, test } from "vitest";

import { snippetLanguages } from "@/lib/settings/build-connection-snippets";
import { buildHttpPostSnippet } from "@/lib/settings/build-http-post-snippet";
import { findFilePlaceholders } from "@/lib/settings/file-placeholders";
import type { JsonValue } from "@/lib/settings/json-literals";

const attachmentBody: JsonValue = {
  from: "app@app.test",
  to: ["user@example.com"],
  attachments: [
    { filename: "invoice.pdf", content: "{{file:invoice.pdf}}" },
    { filename: "logo.png", content: "{{file:logo.png}}", content_id: "logo" },
  ],
};

const attachmentRequest = {
  requestUrl: "http://127.0.0.1:8025/api/v1/send",
  requestHeaders: [],
  requestBody: attachmentBody,
};

describe("findFilePlaceholders", () => {
  test("finds each file once and names a variable per language", () => {
    expect(
      findFilePlaceholders("node", attachmentBody).map(
        (placeholder) => placeholder.variableName,
      ),
    ).toEqual(["invoicePdfContent", "logoPngContent"]);
    expect(
      findFilePlaceholders("python", attachmentBody)[0]?.variableName,
    ).toBe("invoice_pdf_content");
    expect(
      findFilePlaceholders("laravel", attachmentBody)[0]?.variableName,
    ).toBe("$invoicePdfContent");
    expect(findFilePlaceholders("curl", attachmentBody)[0]?.variableName).toBe(
      "INVOICE_PDF_CONTENT",
    );
  });

  test("ignores ordinary strings", () => {
    expect(findFilePlaceholders("node", { body: "file:invoice.pdf" })).toEqual(
      [],
    );
  });
});

describe("file placeholders in snippets", () => {
  test("PL-05.8 every language reads and encodes each file before the request", () => {
    const fileReadCalls = {
      laravel: "base64_encode(file_get_contents('invoice.pdf'))",
      node: 'fs.readFileSync("invoice.pdf").toString("base64")',
      python: 'base64.b64encode(open("invoice.pdf", "rb").read()).decode()',
      go: 'os.ReadFile("invoice.pdf")',
      java: 'Files.readAllBytes(Path.of("invoice.pdf"))',
      ruby: 'Base64.strict_encode64(File.binread("invoice.pdf"))',
      dotnet: 'File.ReadAllBytes("invoice.pdf")',
      curl: "base64 < 'invoice.pdf'",
    };

    for (const language of snippetLanguages) {
      const postSnippet = buildHttpPostSnippet(language, attachmentRequest);

      expect(postSnippet, language).toContain(fileReadCalls[language]);
      expect(postSnippet, language).toContain("logo.png");
      expect(
        postSnippet.indexOf(fileReadCalls[language]),
        language,
      ).toBeLessThan(postSnippet.indexOf("8025/api/v1/send"));
    }
  });

  test("PL-05.8 literal languages use the variable in place of the placeholder", () => {
    expect(buildHttpPostSnippet("laravel", attachmentRequest)).toContain(
      "'content' => $invoicePdfContent,",
    );
    expect(buildHttpPostSnippet("python", attachmentRequest)).toContain(
      '"content": invoice_pdf_content,',
    );
    expect(buildHttpPostSnippet("node", attachmentRequest)).toContain(
      '"content": invoicePdfContent',
    );
    expect(buildHttpPostSnippet("curl", attachmentRequest)).toContain(
      '"content":"${INVOICE_PDF_CONTENT}"',
    );
  });

  test("PL-05.8 string-body languages swap the placeholder for the variable", () => {
    expect(buildHttpPostSnippet("go", attachmentRequest)).toContain(
      '"{{file:invoice.pdf}}", invoicePdfContent, 1)',
    );
    expect(buildHttpPostSnippet("java", attachmentRequest)).toContain(
      '.replace("{{file:invoice.pdf}}", invoicePdfContent)',
    );
    expect(buildHttpPostSnippet("ruby", attachmentRequest)).toContain(
      '.sub("{{file:invoice.pdf}}", invoice_pdf_content)',
    );
    expect(buildHttpPostSnippet("dotnet", attachmentRequest)).toContain(
      '.Replace("{{file:invoice.pdf}}", invoicePdfContent)',
    );
  });
});
