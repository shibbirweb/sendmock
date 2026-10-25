import { ChevronRightIcon, SearchIcon } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  TemplateReference,
  TemplateReferenceField,
  TemplateReferenceHelper,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

function matchesSearch(
  searchText: string,
  ...texts: (string | null)[]
): boolean {
  return texts.some(
    (text) => text !== null && text.toLowerCase().includes(searchText),
  );
}

/** True when the field or any field below it matches, so its branch stays visible. */
function hasMatch(field: TemplateReferenceField, searchText: string): boolean {
  return (
    matchesSearch(searchText, field.path, field.description) ||
    field.children.some((childField) => hasMatch(childField, searchText))
  );
}

function ReferenceEntry({
  title,
  detail,
  description,
  example,
  onInsert,
}: {
  title: string;
  detail: string;
  description: string;
  example: string | null;
  onInsert: () => void;
}) {
  return (
    <button
      type="button"
      title={`Insert ${title}`}
      className="grid w-full min-w-0 gap-0.5 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={onInsert}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <code className="min-w-0 truncate font-mono">{title}</code>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {detail}
        </span>
      </span>
      {description !== "" && (
        <span className="text-[11px] text-muted-foreground">{description}</span>
      )}
      {example !== null && example !== "" && (
        <span className="truncate text-[11px] text-muted-foreground">
          e.g. <code className="font-mono">{example}</code>
        </span>
      )}
    </button>
  );
}

function FieldBranch({
  field,
  searchText,
  onInsert,
}: {
  field: TemplateReferenceField;
  searchText: string;
  onInsert: (insertText: string) => void;
}) {
  const [isExpanded, setExpanded] = React.useState(false);
  if (searchText !== "" && !hasMatch(field, searchText)) {
    return null;
  }

  const isOpen = isExpanded || searchText !== "";
  const entry = (
    <ReferenceEntry
      title={field.path}
      detail={field.value_type}
      description={field.description}
      example={field.example}
      onInsert={() => {
        onInsert(`{{ ${field.path} }}`);
      }}
    />
  );
  if (field.children.length === 0) {
    return <li>{entry}</li>;
  }

  return (
    <li className="grid gap-0.5">
      <div className="flex items-start gap-0.5">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label={`${isOpen ? "Collapse" : "Expand"} ${field.path}`}
          className="mt-1 rounded-sm p-0.5 hover:bg-muted"
          onClick={() => {
            setExpanded((wasExpanded) => !wasExpanded);
          }}
        >
          <ChevronRightIcon
            className={cn(
              "size-3.5 transition-transform",
              isOpen && "rotate-90",
            )}
          />
        </button>
        <div className="min-w-0 flex-1">{entry}</div>
      </div>
      {isOpen && (
        <ul className="ml-4 grid gap-0.5 border-l pl-1.5">
          {field.children.map((childField) => (
            <FieldBranch
              key={childField.path}
              field={childField}
              searchText={searchText}
              onInsert={onInsert}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function HelperGroup({
  title,
  helpers,
  searchText,
  toInsertText,
  onInsert,
}: {
  title: string;
  helpers: TemplateReferenceHelper[];
  searchText: string;
  toInsertText: (helper: TemplateReferenceHelper) => string;
  onInsert: (insertText: string) => void;
}) {
  const visibleHelpers = helpers.filter((helper) =>
    matchesSearch(searchText, helper.name, helper.description),
  );
  if (visibleHelpers.length === 0) {
    return null;
  }

  return (
    <section aria-label={title} className="grid gap-0.5">
      <h4 className="px-1.5 text-[11px] font-medium text-muted-foreground uppercase">
        {title}
      </h4>
      <ul className="grid gap-0.5">
        {visibleHelpers.map((helper) => (
          <li key={helper.name}>
            <ReferenceEntry
              title={helper.name}
              detail={helper.signature}
              description={helper.description}
              example={helper.example}
              onInsert={() => {
                onInsert(toInsertText(helper));
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Everything a template can read, like a GraphQL explorer: searchable,
 * with type, description and example; a click inserts it (WH-07.9).
 */
export function TemplateReferencePanel({
  templateReference,
  onInsert,
}: {
  templateReference: TemplateReference | undefined;
  onInsert: (insertText: string) => void;
}) {
  const searchId = React.useId();
  const [searchText, setSearchText] = React.useState("");
  const normalizedSearch = searchText.trim().toLowerCase();

  return (
    <aside
      aria-label="Template reference"
      className="grid min-w-0 content-start gap-2 rounded-md border p-2"
    >
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={searchId}
          aria-label="Search the reference"
          placeholder="Search values"
          className="h-8 pl-7 text-xs"
          value={searchText}
          onChange={(changeEvent) => {
            setSearchText(changeEvent.target.value);
          }}
        />
      </div>
      {templateReference === undefined ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1">
          <section aria-label="Values" className="grid gap-0.5">
            <h4 className="px-1.5 text-[11px] font-medium text-muted-foreground uppercase">
              Values
            </h4>
            <ul className="grid gap-0.5">
              {templateReference.fields.map((field) => (
                <FieldBranch
                  key={field.path}
                  field={field}
                  searchText={normalizedSearch}
                  onInsert={onInsert}
                />
              ))}
            </ul>
          </section>
          <HelperGroup
            title="Functions"
            helpers={templateReference.functions}
            searchText={normalizedSearch}
            toInsertText={(helper) => `{{ ${helper.name}() }}`}
            onInsert={onInsert}
          />
          <HelperGroup
            title="Filters"
            helpers={templateReference.filters}
            searchText={normalizedSearch}
            toInsertText={(helper) =>
              helper.name === "default" ? ' | default("")' : ` | ${helper.name}`
            }
            onInsert={onInsert}
          />
        </div>
      )}
    </aside>
  );
}
