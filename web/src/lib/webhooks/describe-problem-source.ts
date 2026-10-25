import type { RenderProblem, WebhookEndpointInput } from "@/lib/api/types";

export type RequestPart = "url" | "headers" | "body";

/** Which part of the request preview a problem belongs under. */
export function findRequestPart(problemSource: string): RequestPart {
  if (problemSource === "url" || problemSource.startsWith("query.")) {
    return "url";
  }
  if (problemSource.startsWith("header.")) {
    return "headers";
  }

  return "body";
}

function readSourceIndex(problemSource: string): number {
  return Number(problemSource.split(".")[1] ?? -1);
}

/**
 * Where a problem comes from in words, e.g. "Header X-Tenant" or
 * "Body, line 3 column 12" (WH-07.15).
 */
export function describeProblemSource(
  renderProblem: RenderProblem,
  endpointInput: WebhookEndpointInput,
): string {
  const { source } = renderProblem;
  const sourceIndex = readSourceIndex(source);
  let sourceName = "Body";
  if (source === "url") {
    sourceName = "URL";
  } else if (source.startsWith("query.")) {
    sourceName = `Query param ${endpointInput.query_params[sourceIndex]?.name ?? sourceIndex + 1}`;
  } else if (source.startsWith("header.")) {
    sourceName = `Header ${Object.keys(endpointInput.headers)[sourceIndex] ?? sourceIndex + 1}`;
  } else if (source.startsWith("field.")) {
    sourceName = `Field ${endpointInput.body_fields[sourceIndex]?.name ?? sourceIndex + 1}`;
  }

  // Single-line parts need no position; the body gives line and column.
  return source !== "body" ||
    renderProblem.line === null ||
    renderProblem.column === null
    ? sourceName
    : `${sourceName}, line ${renderProblem.line} column ${renderProblem.column}`;
}

export type LocatedRenderProblem = RenderProblem & {
  line: number;
  column: number;
};

/** Body problems that have a position, for underlining in the code editor. */
export function selectBodyEditorProblems(
  problems: RenderProblem[],
): LocatedRenderProblem[] {
  return problems.filter(
    (renderProblem): renderProblem is LocatedRenderProblem =>
      renderProblem.source === "body" &&
      renderProblem.line !== null &&
      renderProblem.column !== null,
  );
}
