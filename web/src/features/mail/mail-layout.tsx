import { Outlet, useParams, useSearch } from "@tanstack/react-router";

import { MailListPanel } from "@/features/mail/list/mail-list-panel";
import { cn } from "@/lib/utils";

/**
 * List on the left, the selected email on the right. On narrow screens only
 * one pane shows: the list, or the email with a back button.
 */
export function MailLayout() {
  const { q: searchText = "" } = useSearch({ from: "/mail" });
  const { emailId: selectedEmailId } = useParams({ strict: false });

  return (
    <div className="flex h-full min-h-0 flex-1">
      <section
        aria-label="Email list"
        className={cn(
          "flex min-h-0 w-full flex-col border-r md:w-96 md:shrink-0 xl:w-[26rem]",
          selectedEmailId !== undefined && "hidden md:flex",
        )}
      >
        <MailListPanel
          searchText={searchText}
          selectedEmailId={selectedEmailId}
        />
      </section>
      <section
        aria-label="Email"
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          selectedEmailId === undefined && "hidden md:flex",
        )}
      >
        <Outlet />
      </section>
    </div>
  );
}
