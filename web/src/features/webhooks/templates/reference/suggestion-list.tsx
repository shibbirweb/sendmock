import type { TemplateSuggestion } from "@/lib/webhooks/template-suggestions";
import { cn } from "@/lib/utils";

/** A value's type (string, object, ...), or what kind of helper it is. */
function readKindLabel(suggestion: TemplateSuggestion): string {
  return suggestion.suggestionKind === "field"
    ? suggestion.detail
    : suggestion.suggestionKind;
}

/** The popup under the caret: label, type or signature, description and example (WH-07.10). */
export function SuggestionList({
  listId,
  suggestions,
  activeIndex,
  position,
  onPick,
  onHover,
}: {
  listId: string;
  suggestions: TemplateSuggestion[];
  activeIndex: number;
  position: { top: number; left: number };
  onPick: (pickedSuggestion: TemplateSuggestion) => void;
  onHover: (hoveredIndex: number) => void;
}) {
  const activeSuggestion = suggestions[activeIndex];

  return (
    <div
      className="absolute z-50 flex w-[min(28rem,calc(100%-1rem))] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
      style={{ top: position.top, left: Math.max(0, position.left) }}
    >
      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        className="max-h-56 min-w-0 flex-1 overflow-y-auto py-1"
      >
        {suggestions.map((suggestion, suggestionIndex) => (
          <li
            key={`${suggestion.suggestionKind}-${suggestion.label}`}
            id={`${listId}-${suggestionIndex}`}
            role="option"
            aria-selected={suggestionIndex === activeIndex}
            className={cn(
              "flex cursor-pointer items-center gap-2 px-2.5 py-1 text-xs",
              suggestionIndex === activeIndex &&
                "bg-accent text-accent-foreground",
            )}
            onMouseDown={(mouseEvent) => {
              // Keep focus in the field so the caret stays where it was.
              mouseEvent.preventDefault();
              onPick(suggestion);
            }}
            onMouseEnter={() => {
              onHover(suggestionIndex);
            }}
          >
            <span className="min-w-0 flex-1 truncate font-mono">
              {suggestion.label}
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {readKindLabel(suggestion)}
            </span>
          </li>
        ))}
      </ul>
      {activeSuggestion !== undefined && (
        <div className="hidden w-44 shrink-0 gap-1 border-l p-2.5 text-xs sm:grid sm:content-start">
          <code className="font-mono text-[11px] break-all text-muted-foreground">
            {activeSuggestion.detail}
          </code>
          {activeSuggestion.description !== "" && (
            <p>{activeSuggestion.description}</p>
          )}
          {activeSuggestion.example !== null &&
            activeSuggestion.example !== "" && (
              <p className="break-all text-muted-foreground">
                e.g.{" "}
                <code className="font-mono">{activeSuggestion.example}</code>
              </p>
            )}
        </div>
      )}
    </div>
  );
}
