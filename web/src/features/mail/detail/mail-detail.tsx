import * as React from "react";

import { usePageTitle } from "@/hooks/use-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExtractedDataPanel } from "@/features/mail/detail/extracted-data-panel";
import { MailDetailHeader } from "@/features/mail/detail/mail-detail-header";
import { EmailHtmlPreview } from "@/features/mail/detail/preview/email-html-preview";
import type { EmailComposerMode } from "@/features/mail/detail/response/email-composer-mode";
import { EmailResponseComposer } from "@/features/mail/detail/response/email-response-composer";
import { useEmailResponseShortcuts } from "@/features/mail/detail/response/use-email-response-shortcuts";
import { EmailChecksTab } from "@/features/mail/detail/tabs/email-checks-tab";
import {
  EmailAttachmentsTab,
  EmailMimeTab,
  EmailTimelineTab,
} from "@/features/mail/detail/tabs/email-parts-tabs";
import {
  EmailHeadersTab,
  EmailSourceTab,
  EmailTemplateDataTab,
  EmailTextTab,
} from "@/features/mail/detail/tabs/email-source-tabs";
import { useEmailOpenTracking } from "@/features/mail/detail/use-email-open-tracking";
import { useEmail, useEmailTimeline } from "@/lib/api/hooks/use-email-queries";
import { useOperationAvailability } from "@/lib/api/hooks/use-operation-availability";

export function MailDetail({ emailId }: { emailId: string }) {
  const emailQuery = useEmail(emailId);
  const timelineQuery = useEmailTimeline(emailId);
  const email = emailQuery.data;
  usePageTitle(email?.subject || "(no subject)", "Mail");
  // The route keys this component by email, so a composer never outlives it.
  const [composerMode, setComposerMode] =
    React.useState<EmailComposerMode | null>(null);
  useEmailOpenTracking(email);
  useEmailResponseShortcuts(email, setComposerMode);
  const checksAvailability = useOperationAvailability(
    "GET /api/v1/emails/{emailId}/html-check",
  );

  if (emailQuery.isPending) {
    return (
      <div className="grid gap-4 p-6">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (email === undefined) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        This email no longer exists. It may have been deleted or pruned.
      </p>
    );
  }

  const tabDefinitions = [
    { value: "html", label: "HTML", isShown: email.html_body !== null },
    { value: "text", label: "Text", isShown: true },
    { value: "source", label: "Source", isShown: true },
    { value: "headers", label: "Headers", isShown: true },
    {
      value: "attachments",
      label: `Attachments (${email.attachment_count})`,
      isShown: email.attachment_count > 0,
    },
    { value: "mime", label: "MIME", isShown: true },
    { value: "checks", label: "Checks", isShown: true },
    { value: "timeline", label: "Timeline", isShown: true },
    {
      value: "template",
      label: "Template data",
      isShown: email.template !== null,
    },
  ].filter((tabDefinition) => tabDefinition.isShown);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <MailDetailHeader email={email} onStartResponse={setComposerMode} />
      {composerMode !== null && (
        <EmailResponseComposer
          key={composerMode}
          email={email}
          composerMode={composerMode}
          onClose={() => {
            setComposerMode(null);
          }}
        />
      )}
      <ExtractedDataPanel extracted={email.extracted} />
      <Tabs
        defaultValue={tabDefinitions[0]?.value}
        className="gap-4 px-4 py-4 sm:px-6"
      >
        {/* Up to ten tabs: they wrap inside the pill rather than scroll out of sight. */}
        <TabsList className="flex-wrap justify-start group-data-horizontal/tabs:h-auto">
          {tabDefinitions.map((tabDefinition) =>
            tabDefinition.value === "checks" &&
            !checksAvailability.isAvailable ? (
              <Tooltip key={tabDefinition.value}>
                <TooltipTrigger asChild>
                  {/* A disabled tab gets no pointer events, so the tooltip hangs on a wrapper. */}
                  <span tabIndex={0} className="inline-flex">
                    <TabsTrigger
                      value={tabDefinition.value}
                      disabled
                      aria-label={`${tabDefinition.label}: ${checksAvailability.unavailableLabel}`}
                      className="h-7 flex-none"
                    >
                      {tabDefinition.label}
                    </TabsTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {checksAvailability.unavailableLabel}
                </TooltipContent>
              </Tooltip>
            ) : (
              <TabsTrigger
                key={tabDefinition.value}
                value={tabDefinition.value}
                className="h-7 flex-none"
              >
                {tabDefinition.label}
              </TabsTrigger>
            ),
          )}
        </TabsList>
        <TabsContent value="html">
          <EmailHtmlPreview email={email} />
        </TabsContent>
        <TabsContent value="text">
          <EmailTextTab email={email} />
        </TabsContent>
        <TabsContent value="source">
          <EmailSourceTab email={email} />
        </TabsContent>
        <TabsContent value="headers">
          <EmailHeadersTab email={email} />
        </TabsContent>
        <TabsContent value="attachments">
          <EmailAttachmentsTab email={email} />
        </TabsContent>
        <TabsContent value="mime">
          <EmailMimeTab email={email} />
        </TabsContent>
        <TabsContent value="checks">
          <EmailChecksTab email={email} />
        </TabsContent>
        <TabsContent value="timeline">
          <EmailTimelineTab timelineEntries={timelineQuery.data ?? []} />
        </TabsContent>
        <TabsContent value="template">
          <EmailTemplateDataTab email={email} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
