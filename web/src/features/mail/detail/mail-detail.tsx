import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExtractedDataPanel } from "@/features/mail/detail/extracted-data-panel";
import { MailDetailHeader } from "@/features/mail/detail/mail-detail-header";
import { EmailHtmlPreview } from "@/features/mail/detail/preview/email-html-preview";
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

export function MailDetail({ emailId }: { emailId: string }) {
  const emailQuery = useEmail(emailId);
  const timelineQuery = useEmailTimeline(emailId);
  const email = emailQuery.data;
  useEmailOpenTracking(email);

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
      <MailDetailHeader email={email} />
      <ExtractedDataPanel extracted={email.extracted} />
      <Tabs
        defaultValue={tabDefinitions[0]?.value}
        className="gap-4 px-4 py-4 sm:px-6"
      >
        <TabsList className="h-auto flex-wrap justify-start">
          {tabDefinitions.map((tabDefinition) => (
            <TabsTrigger key={tabDefinition.value} value={tabDefinition.value}>
              {tabDefinition.label}
            </TabsTrigger>
          ))}
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
