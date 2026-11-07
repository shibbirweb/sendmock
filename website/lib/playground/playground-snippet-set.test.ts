import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { loadApiReference } from "@/lib/openapi/load-openapi";

import { snippetLanguages } from "./build-snippets";
import { playgroundSnippetFilePath } from "./playground-snippet-file";
import {
  buildPlaygroundSnippetSet,
  emailIdPlaceholder,
  renderPlaygroundSnippetFile,
} from "./playground-snippet-set";

const apiReference = loadApiReference();
const snippetSet = buildPlaygroundSnippetSet(
  apiReference.operations,
  apiReference.schemas,
);

describe("the playground snippets CI runs", () => {
  test("WS-04.2 the committed snippets are a fresh render of the playground's builders", () => {
    const committedFile = readFileSync(playgroundSnippetFilePath, "utf8");

    expect(
      committedFile,
      "Run `bun scripts/write-playground-snippets.ts` in website/.",
    ).toBe(renderPlaygroundSnippetFile(snippetSet));
  });

  test("WS-04.2 the set covers every method, a path, a query and a body, in every language", () => {
    const requests = snippetSet.playgroundSnippets.map(
      (playgroundSnippet) => playgroundSnippet.request,
    );

    expect([...new Set(requests.map((request) => request.method))]).toEqual([
      "GET",
      "POST",
      "PATCH",
      "DELETE",
    ]);
    expect(requests.some((request) => request.url.includes("?query="))).toBe(
      true,
    );
    expect(
      requests.some((request) => request.url.includes(emailIdPlaceholder)),
    ).toBe(true);
    expect(requests.some((request) => request.body !== null)).toBe(true);
    for (const playgroundSnippet of snippetSet.playgroundSnippets) {
      expect(Object.keys(playgroundSnippet.snippets)).toEqual(
        snippetLanguages.map((snippetLanguage) => snippetLanguage.key),
      );
    }
  });

  test("WS-04.2 a body starts as the operation's full example, as the form does", () => {
    const sendEmail = snippetSet.playgroundSnippets.find(
      (playgroundSnippet) => playgroundSnippet.label === "send-email",
    );

    expect(sendEmail?.request.headers).toEqual({
      "content-type": "application/json",
    });
    expect(JSON.parse(sendEmail?.request.body ?? "{}")).toMatchObject({
      subject: "Your order #1042 has shipped",
    });
  });
});
