"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  ApiOperation,
  SchemaComponents,
} from "@/lib/openapi/openapi-types";
import { listSchemaFields } from "@/lib/openapi/schema-fields";
import {
  findBodyProblems,
  parseBodyObject,
} from "@/lib/playground/body-fields";
import type { PlaygroundResponse } from "@/lib/playground/bridge-messages";
import {
  buildCliSnippet,
  buildMcpSnippet,
  type SnippetFormValues,
} from "@/lib/playground/build-surface-snippets";
import { useDemoBridge } from "@/lib/playground/demo-bridge-provider";
import { findDemoPathValues } from "@/lib/playground/demo-path-values";
import {
  buildInitialBody,
  buildRequestHeaders,
  buildRequestPath,
  buildSnippetRequest,
} from "@/lib/playground/snippet-request";

/**
 * The request builder's state for one operation: path and query values and
 * the body, the request they make, its snippets source and the last answer.
 */
export function usePlaygroundRequest(
  operation: ApiOperation,
  schemas: SchemaComponents,
) {
  const { isReady, sendRequest } = useDemoBridge();
  const pathParameterNames = useMemo(
    () =>
      operation.parameters
        .filter((parameter) => parameter.location === "path")
        .map((parameter) => parameter.name),
    [operation],
  );
  const [pathValues, setPathValues] = useState<Record<string, string>>({});
  const [queryValues, setQueryValues] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState(() =>
    buildInitialBody(operation, schemas),
  );
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sentAtMs, setSentAtMs] = useState<number | null>(null);

  useEffect(() => {
    setQueryValues({});
    setResponse(null);
    setBodyText(buildInitialBody(operation, schemas));
    if (!isReady || pathParameterNames.length === 0) {
      setPathValues({});
      return;
    }
    let isCurrent = true;
    void findDemoPathValues(
      operation.path,
      pathParameterNames,
      sendRequest,
    ).then((demoValues) => {
      if (isCurrent) {
        setPathValues(demoValues);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [operation, schemas, isReady, pathParameterNames, sendRequest]);

  const requestPath = useMemo(
    () => buildRequestPath(operation.path, pathValues, queryValues),
    [operation.path, pathValues, queryValues],
  );
  const requestHeaders = useMemo(
    () => buildRequestHeaders(operation),
    [operation],
  );
  const requestBody = operation.requestBody === null ? null : bodyText;
  const isJsonBody =
    operation.requestBody?.contentType.includes("json") ?? false;
  const bodyFields = useMemo(
    () =>
      operation.requestBody === null || !isJsonBody
        ? []
        : listSchemaFields(operation.requestBody.schema, schemas),
    [operation.requestBody, isJsonBody, schemas],
  );
  const bodyProblems = useMemo(
    () =>
      isJsonBody
        ? findBodyProblems(
            bodyText,
            bodyFields.filter((bodyField) => bodyField.depth === 0),
          )
        : [],
    [isJsonBody, bodyText, bodyFields],
  );
  const snippetFormValues: SnippetFormValues = {
    pathValues,
    queryValues,
    bodyObject: isJsonBody
      ? (parseBodyObject(bodyText) ?? undefined)
      : undefined,
    rawBody: isJsonBody ? null : requestBody,
  };
  const surfaceSnippets = {
    cli:
      operation.surfaces.cliSnippetSource === null
        ? null
        : {
            text: buildCliSnippet(
              operation.surfaces.cliSnippetSource,
              snippetFormValues,
            ),
            url: operation.surfaces.cliSnippetSource.url,
          },
    mcp:
      operation.surfaces.mcpSnippetSource === null
        ? null
        : {
            text: buildMcpSnippet(
              operation.surfaces.mcpSnippetSource,
              snippetFormValues,
            ),
            url: operation.surfaces.mcpSnippetSource.url,
          },
    mcpExemptReason: operation.surfaces.mcpExemptReason,
  };
  const snippetRequest = buildSnippetRequest(operation, {
    pathValues,
    queryValues,
    bodyText,
  });

  const send = async () => {
    setIsSending(true);
    setSentAtMs(Date.now());
    const playgroundResponse = await sendRequest({
      method: operation.method,
      path: requestPath,
      headers: requestHeaders,
      body: requestBody,
    });
    setResponse(playgroundResponse);
    setIsSending(false);
  };

  return {
    isReady,
    pathValues,
    setPathValues,
    queryValues,
    setQueryValues,
    bodyText,
    setBodyText,
    resetBody: () => setBodyText(buildInitialBody(operation, schemas)),
    bodyFields,
    bodyProblems,
    snippetRequest,
    surfaceSnippets,
    response,
    isSending,
    sentAtMs,
    send,
  };
}
