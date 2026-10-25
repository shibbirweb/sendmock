"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  ApiOperation,
  SchemaComponents,
} from "@/lib/openapi/openapi-types";
import { buildExampleValue } from "@/lib/openapi/schema-tools";
import type { PlaygroundResponse } from "@/lib/playground/bridge-messages";
import type { SnippetRequest } from "@/lib/playground/build-snippets";
import { useDemoBridge } from "@/lib/playground/demo-bridge-provider";
import { findDemoPathValues } from "@/lib/playground/demo-path-values";

/** Where snippets point: a SendMock running on its default address. */
const localInstanceUrl = "http://127.0.0.1:8025";

function buildInitialBody(
  operation: ApiOperation,
  schemas: SchemaComponents,
): string {
  if (operation.requestBody === null) {
    return "";
  }
  if (!operation.requestBody.contentType.includes("json")) {
    return "hello from the playground";
  }
  return JSON.stringify(
    buildExampleValue(operation.requestBody.schema, schemas),
    null,
    2,
  );
}

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

  const requestPath = useMemo(() => {
    const filledPath = operation.path.replace(
      /\{(\w+)\}/g,
      (_match, parameterName: string) =>
        encodeURIComponent(pathValues[parameterName] ?? ""),
    );
    const queryString = new URLSearchParams(
      Object.entries(queryValues).filter(([, queryValue]) => queryValue !== ""),
    ).toString();
    return queryString === "" ? filledPath : `${filledPath}?${queryString}`;
  }, [operation.path, pathValues, queryValues]);
  const requestHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (operation.requestBody) {
      // `*/*` (the capture URL takes anything) is not a sendable type.
      headers["content-type"] = operation.requestBody.contentType.includes("*")
        ? "text/plain"
        : operation.requestBody.contentType;
    }
    return headers;
  }, [operation.requestBody]);
  const requestBody = operation.requestBody === null ? null : bodyText;
  const snippetRequest: SnippetRequest = {
    method: operation.method,
    url: `${localInstanceUrl}${requestPath}`,
    headers: requestHeaders,
    body: requestBody,
  };

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
    snippetRequest,
    response,
    isSending,
    sentAtMs,
    send,
  };
}
