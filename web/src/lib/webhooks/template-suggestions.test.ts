import { describe, expect, test } from "vitest";

import type {
  TemplateReference,
  TemplateReferenceField,
} from "@/lib/api/types";
import {
  applyTemplateSuggestion,
  findSuggestionQuery,
  listTemplateSuggestions,
} from "@/lib/webhooks/template-suggestions";

function field(
  path: string,
  children: TemplateReferenceField[] = [],
): TemplateReferenceField {
  return {
    path,
    name: path.split(".").pop() ?? path,
    value_type: children.length > 0 ? "object" : "string",
    description: `About ${path}`,
    example: null,
    children,
  };
}

const templateReference: TemplateReference = {
  fields: [
    field("event", [
      field("event.id"),
      field("event.type"),
      field("event.created_at"),
    ]),
    field("data", [
      field("data.subject"),
      field("data.status"),
      field("data.to", [
        field("data.to[0]", [
          field("data.to[0].address"),
          field("data.to[0].name"),
        ]),
      ]),
    ]),
  ],
  functions: [
    {
      name: "now_unix",
      signature: "now_unix()",
      description: "Now.",
      example: "1",
    },
  ],
  filters: [
    {
      name: "lower",
      signature: "lower",
      description: "Lowercase.",
      example: "",
    },
    {
      name: "default",
      signature: "default(fallback)",
      description: "Fallback.",
      example: "",
    },
  ],
};

function suggestFor(templateWithCursor: string) {
  const cursorIndex = templateWithCursor.indexOf("|>");
  const templateText = templateWithCursor.replace("|>", "");
  const suggestionQuery = findSuggestionQuery(templateText, cursorIndex);

  return suggestionQuery === null
    ? null
    : listTemplateSuggestions(templateReference, suggestionQuery).map(
        (suggestion) => suggestion.label,
      );
}

describe("template suggestions", () => {
  test("WH-07.10 suggests nothing outside {{ }}", () => {
    expect(suggestFor('{ "a": "|>" }')).toBeNull();
    expect(suggestFor("{{ data.subject }} |>")).toBeNull();
  });

  test("WH-07.10 suggests top-level keys and functions right after {{", () => {
    expect(suggestFor("{{ |>")).toEqual(["event", "data", "now_unix"]);
    expect(suggestFor("{{ ev|>")).toEqual(["event"]);
  });

  test("WH-07.10 suggests the children after a dot", () => {
    expect(suggestFor("{{ event.|>")).toEqual([
      "event.id",
      "event.type",
      "event.created_at",
    ]);
    expect(suggestFor("{{ data.s|>")).toEqual(["data.subject", "data.status"]);
    expect(suggestFor("{{ data.to|>")).toEqual(["data.to[0]"]);
    expect(suggestFor("{{ data.to[0].|>")).toEqual([
      "data.to[0].address",
      "data.to[0].name",
    ]);
  });

  test("WH-07.10 suggests filters after a pipe", () => {
    expect(suggestFor("{{ data.subject | |>")).toEqual(["lower", "default"]);
    expect(suggestFor("{{ data.subject | lo|>")).toEqual(["lower"]);
    expect(suggestFor('{{ data.subject | default("x") |>')).toBeNull();
  });

  test("WH-07.10 inserting replaces what was typed and places the cursor", () => {
    const templateText = "{{ data.su }}";
    const cursorIndex = "{{ data.su".length;
    const suggestionQuery = findSuggestionQuery(templateText, cursorIndex);
    if (suggestionQuery === null) {
      throw new Error("Expected a query inside the expression.");
    }
    const [subjectSuggestion] = listTemplateSuggestions(
      templateReference,
      suggestionQuery,
    );
    if (subjectSuggestion === undefined) {
      throw new Error("Expected a suggestion.");
    }

    expect(
      applyTemplateSuggestion(
        templateText,
        cursorIndex,
        suggestionQuery,
        subjectSuggestion,
      ),
    ).toEqual({
      nextText: "{{ data.subject }}",
      nextCursorIndex: "{{ data.subject".length,
    });

    const functionQuery = findSuggestionQuery("{{ now", 6);
    const [nowSuggestion] =
      functionQuery === null
        ? []
        : listTemplateSuggestions(templateReference, functionQuery);
    if (functionQuery === null || nowSuggestion === undefined) {
      throw new Error("Expected a function suggestion.");
    }
    expect(
      applyTemplateSuggestion("{{ now", 6, functionQuery, nowSuggestion),
    ).toEqual({
      nextText: "{{ now_unix()",
      nextCursorIndex: "{{ now_unix(".length,
    });
  });
});
