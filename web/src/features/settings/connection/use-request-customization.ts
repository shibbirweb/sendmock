import * as React from "react";

import {
  type RequestCustomization,
  sampleEmailRequestBody,
  sampleSmsRequestBody,
} from "@/lib/settings/build-connection-snippets";
import type { SnippetHeader } from "@/lib/settings/build-http-post-snippet";
import type { JsonValue } from "@/lib/settings/json-literals";

export type HeaderRow = SnippetHeader & { rowId: number };

export type BodyEditorState = {
  bodyText: string;
  /** Last body that parsed; the snippets keep using it while the text is invalid. */
  lastValidBody: JsonValue;
  isInvalid: boolean;
};

function createBodyEditorState(initialBody: JsonValue): BodyEditorState {
  return {
    bodyText: JSON.stringify(initialBody, null, 2),
    lastValidBody: initialBody,
    isInvalid: false,
  };
}

function updateBodyText(
  previousState: BodyEditorState,
  bodyText: string,
): BodyEditorState {
  try {
    return {
      bodyText,
      lastValidBody: JSON.parse(bodyText) as JsonValue,
      isInvalid: false,
    };
  } catch {
    return { ...previousState, bodyText, isInvalid: true };
  }
}

/** Adds a top-level field to a JSON object body, unless it is already there. */
export function addBodyField(
  bodyState: BodyEditorState,
  fieldName: string,
  exampleValue: JsonValue,
): BodyEditorState {
  const currentBody = bodyState.lastValidBody;
  if (
    bodyState.isInvalid ||
    currentBody === null ||
    typeof currentBody !== "object" ||
    Array.isArray(currentBody)
  ) {
    return bodyState;
  }

  return createBodyEditorState({ ...currentBody, [fieldName]: exampleValue });
}

/** Header rows and editable bodies behind the Connection snippets (PL-05.7). */
export function useRequestCustomization() {
  const nextRowIdRef = React.useRef(1);
  const [headerRows, setHeaderRows] = React.useState<HeaderRow[]>([]);
  const [emailBody, setEmailBody] = React.useState(() =>
    createBodyEditorState(sampleEmailRequestBody),
  );
  const [smsBody, setSmsBody] = React.useState(() =>
    createBodyEditorState(sampleSmsRequestBody),
  );

  const addHeaderRow = (headerName = "", headerValue = "") => {
    const rowId = nextRowIdRef.current;
    nextRowIdRef.current += 1;
    setHeaderRows((previousRows) => [
      ...previousRows,
      { rowId, headerName, headerValue },
    ]);
  };

  const updateHeaderRow = (
    rowId: number,
    changedFields: Partial<SnippetHeader>,
  ) => {
    setHeaderRows((previousRows) =>
      previousRows.map((headerRow) =>
        headerRow.rowId === rowId
          ? { ...headerRow, ...changedFields }
          : headerRow,
      ),
    );
  };

  const removeHeaderRow = (rowId: number) => {
    setHeaderRows((previousRows) =>
      previousRows.filter((headerRow) => headerRow.rowId !== rowId),
    );
  };

  const isCustomized =
    headerRows.length > 0 ||
    emailBody.bodyText !==
      createBodyEditorState(sampleEmailRequestBody).bodyText ||
    smsBody.bodyText !== createBodyEditorState(sampleSmsRequestBody).bodyText;

  /** Back to the sample bodies, without added headers. */
  const resetCustomization = () => {
    setHeaderRows([]);
    setEmailBody(createBodyEditorState(sampleEmailRequestBody));
    setSmsBody(createBodyEditorState(sampleSmsRequestBody));
  };

  const requestCustomization: RequestCustomization = {
    // Rows without a name are still being typed, so they are left out.
    requestHeaders: headerRows
      .filter((headerRow) => headerRow.headerName.trim() !== "")
      .map(({ headerName, headerValue }) => ({
        headerName: headerName.trim(),
        headerValue,
      })),
    emailRequestBody: emailBody.lastValidBody,
    smsRequestBody: smsBody.lastValidBody,
  };

  return {
    headerRows,
    addHeaderRow,
    updateHeaderRow,
    removeHeaderRow,
    emailBody,
    setEmailBodyText: (bodyText: string) =>
      setEmailBody((previousState) => updateBodyText(previousState, bodyText)),
    addEmailBodyField: (fieldName: string, exampleValue: JsonValue) =>
      setEmailBody((previousState) =>
        addBodyField(previousState, fieldName, exampleValue),
      ),
    smsBody,
    setSmsBodyText: (bodyText: string) =>
      setSmsBody((previousState) => updateBodyText(previousState, bodyText)),
    addSmsBodyField: (fieldName: string, exampleValue: JsonValue) =>
      setSmsBody((previousState) =>
        addBodyField(previousState, fieldName, exampleValue),
      ),
    requestCustomization,
    isCustomized,
    resetCustomization,
  };
}
