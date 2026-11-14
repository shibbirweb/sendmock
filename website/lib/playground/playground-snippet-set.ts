import type {
  ApiOperation,
  SchemaComponents,
} from "@/lib/openapi/openapi-types";

import {
  buildSnippet,
  type SnippetLanguage,
  type SnippetRequest,
  snippetLanguages,
} from "./build-snippets";
import { buildInitialBody, buildSnippetRequest } from "./snippet-request";

/** Stands for the id of an email the runner stores before the snippets run. */
export const emailIdPlaceholder = "EMAIL_ID_PLACEHOLDER";

type PlaygroundSnippetCase = {
  label: string;
  method: string;
  path: string;
  pathValues?: Record<string, string>;
  queryValues?: Record<string, string>;
};

/**
 * The requests run against a real SendMock in CI (WS-04.2): every method,
 * and a path, a query and a JSON body input, each as the form shows it.
 */
const playgroundSnippetCases: PlaygroundSnippetCase[] = [
  { label: "health", method: "GET", path: "/api/v1/health" },
  { label: "send-email", method: "POST", path: "/api/v1/send" },
  { label: "send-sms", method: "POST", path: "/api/v1/sms" },
  {
    label: "search-emails",
    method: "GET",
    path: "/api/v1/emails",
    queryValues: { query: "1042" },
  },
  {
    label: "update-email",
    method: "PATCH",
    path: "/api/v1/emails/{emailId}",
    pathValues: { emailId: emailIdPlaceholder },
  },
  {
    label: "delete-email",
    method: "DELETE",
    path: "/api/v1/emails/{emailId}",
    pathValues: { emailId: emailIdPlaceholder },
  },
];

export type PlaygroundSnippet = {
  label: string;
  request: SnippetRequest;
  snippets: Record<SnippetLanguage, string>;
};

export type PlaygroundSnippetSet = {
  emailIdPlaceholder: string;
  playgroundSnippets: PlaygroundSnippet[];
};

function findOperation(
  operations: ApiOperation[],
  snippetCase: PlaygroundSnippetCase,
): ApiOperation {
  const operation = operations.find(
    (candidate) =>
      candidate.method === snippetCase.method &&
      candidate.path === snippetCase.path,
  );
  if (operation === undefined) {
    throw new Error(
      `The spec has no ${snippetCase.method} ${snippetCase.path}.`,
    );
  }
  return operation;
}

/** Every case's request and its snippet in each language, from the spec. */
export function buildPlaygroundSnippetSet(
  operations: ApiOperation[],
  schemas: SchemaComponents,
): PlaygroundSnippetSet {
  const playgroundSnippets = playgroundSnippetCases.map((snippetCase) => {
    const operation = findOperation(operations, snippetCase);
    const request = buildSnippetRequest(operation, {
      pathValues: snippetCase.pathValues ?? {},
      queryValues: snippetCase.queryValues ?? {},
      bodyText: buildInitialBody(operation, schemas),
    });
    const snippets = Object.fromEntries(
      snippetLanguages.map((snippetLanguage) => [
        snippetLanguage.key,
        buildSnippet(snippetLanguage.key, request),
      ]),
    ) as Record<SnippetLanguage, string>;
    return { label: snippetCase.label, request, snippets };
  });

  return { emailIdPlaceholder, playgroundSnippets };
}

/** The file the runner reads, as `bun run playground-snippets` writes it. */
export function renderPlaygroundSnippetFile(
  snippetSet: PlaygroundSnippetSet,
): string {
  return `${JSON.stringify(snippetSet, null, 2)}\n`;
}
