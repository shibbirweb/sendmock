import { InboxIcon } from "lucide-react";

import { ConnectHint } from "@/features/onboarding/connect-hint";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { NoMatchState } from "@/features/onboarding/no-match-state";
import { SampleButton } from "@/features/onboarding/sample-button";

/** Shown when the list is empty: how to connect, or how to widen the search. */
export function MailListEmptyState({
  hasActiveSearch,
  onClearSearch,
}: {
  hasActiveSearch: boolean;
  onClearSearch: () => void;
}) {
  if (hasActiveSearch) {
    return (
      <NoMatchState
        message="No emails match this search."
        clearLabel="Clear search"
        onClearFilter={onClearSearch}
        className="flex-1"
      />
    );
  }

  return (
    <NoDataState
      icon={InboxIcon}
      title="No emails yet"
      description="Point your app's SMTP settings at SendMock and send something. No auth or TLS needed."
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <ConnectHint connectArea="smtp" />
      <SampleButton sampleKind="email" />
    </NoDataState>
  );
}
