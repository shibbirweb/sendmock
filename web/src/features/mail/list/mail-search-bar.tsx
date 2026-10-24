import { useNavigate } from "@tanstack/react-router";
import { SearchIcon, XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  mailSearchChips,
  toggleSearchToken,
} from "@/features/mail/parse-mail-search";
import { cn } from "@/lib/utils";

const searchDebounceMs = 250;

type MailSearchBarProps = {
  searchText: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
};

/** Search box plus quick filter chips; the text lives in the URL (`?q=`). */
export function MailSearchBar({
  searchText,
  searchInputRef,
}: MailSearchBarProps) {
  const navigate = useNavigate({ from: "/mail" });
  const [draftSearchText, setDraftSearchText] = React.useState(searchText);

  const applySearchText = React.useCallback(
    (nextSearchText: string) => {
      void navigate({
        search: (previousSearch) => ({
          ...previousSearch,
          q: nextSearchText.trim() === "" ? undefined : nextSearchText,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  React.useEffect(() => {
    if (draftSearchText === searchText) {
      return undefined;
    }

    const debounceTimer = setTimeout(() => {
      applySearchText(draftSearchText);
    }, searchDebounceMs);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [draftSearchText, searchText, applySearchText]);

  const updateSearchText = (nextSearchText: string) => {
    setDraftSearchText(nextSearchText);
    applySearchText(nextSearchText);
  };

  return (
    <div className="grid gap-2 border-b p-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={draftSearchText}
          onChange={(changeEvent) => {
            setDraftSearchText(changeEvent.target.value);
          }}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === "Escape") {
              keyboardEvent.currentTarget.blur();
            }
          }}
          placeholder="Search, or from: to: tag: is:unread"
          aria-label="Search emails"
          className="pr-8 pl-8"
        />
        {draftSearchText !== "" && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear search"
            className="absolute top-1/2 right-1 size-6 -translate-y-1/2"
            onClick={() => {
              updateSearchText("");
            }}
          >
            <XIcon />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {mailSearchChips.map((searchChip) => {
          const isChipActive = draftSearchText
            .split(/\s+/)
            .includes(searchChip.token);

          return (
            <button
              key={searchChip.token}
              type="button"
              aria-pressed={isChipActive}
              onClick={() => {
                updateSearchText(
                  toggleSearchToken(draftSearchText, searchChip.token),
                );
              }}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-muted",
                isChipActive &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {searchChip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
