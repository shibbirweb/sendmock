import { MessageSquareIcon } from "lucide-react";

import { ConnectHint } from "@/features/onboarding/connect-hint";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { NoMatchState } from "@/features/onboarding/no-match-state";
import { SampleButton } from "@/features/onboarding/sample-button";

/** Shown when there are no conversations: how to connect, or how to widen the filter. */
export function SmsThreadEmptyState({
  hasActiveFilter,
  onClearFilter,
}: {
  hasActiveFilter: boolean;
  onClearFilter: () => void;
}) {
  if (hasActiveFilter) {
    return (
      <NoMatchState
        message="No conversations match this filter."
        onClearFilter={onClearFilter}
        className="flex-1"
      />
    );
  }

  return (
    <NoDataState
      icon={MessageSquareIcon}
      title="No SMS yet"
      description="Send through the SendMock API, or point your Twilio or Vonage SDK at SendMock."
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <ConnectHint connectArea="sms" />
      <SampleButton sampleKind="sms" />
    </NoDataState>
  );
}
