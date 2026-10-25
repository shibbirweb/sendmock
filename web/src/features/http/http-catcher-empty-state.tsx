import type { LucideIcon } from "lucide-react";

import { CopyButton } from "@/components/common/copy-button";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { SampleButton } from "@/features/onboarding/sample-button";
import { useCatchUrl } from "@/features/http/use-catch-url";

/** No bins yet: where to point an app, a cURL example and a sample (HC-01.6). */
export function HttpCatcherEmptyState({ icon }: { icon: LucideIcon }) {
  const catchUrl = useCatchUrl("slack");
  const curlExample = `curl -X POST ${catchUrl} -H 'content-type: application/json' -d '{"text":"Hello from my app"}'`;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <NoDataState
        icon={icon}
        title="No requests caught yet"
        description="Point your app's Slack, Discord, push or other HTTP calls at SendMock. Any path under /catch/<bin>/ is captured, and the bin is created on first use."
      >
        <div className="grid w-full max-w-lg gap-2 text-left">
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 font-mono text-xs">
            <span className="min-w-0 flex-1 break-all">{curlExample}</span>
            <CopyButton copyText={curlExample} label="Copy cURL example" />
          </div>
        </div>
        <SampleButton sampleKind="http" />
      </NoDataState>
    </div>
  );
}
