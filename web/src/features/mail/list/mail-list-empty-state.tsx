import { InboxIcon, SearchXIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSendEmail } from "@/lib/api/hooks/use-email-queries";

const sampleEmail = {
  from: '"Acme App" <no-reply@acme.test>',
  to: ["you@example.com"],
  subject: "Your verification code",
  text: "Hi! Your verification code is 739104. It expires in 10 minutes.",
  html: "<h2>Verify your account</h2><p>Your verification code is <strong>739104</strong>. It expires in 10 minutes.</p>",
};

/** Shown when the list is empty: how to connect, or how to widen the search. */
export function MailListEmptyState({
  hasActiveSearch,
  onClearSearch,
}: {
  hasActiveSearch: boolean;
  onClearSearch: () => void;
}) {
  const sendEmail = useSendEmail();

  if (hasActiveSearch) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <SearchXIcon className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No emails match this search.
        </p>
        <Button variant="outline" size="sm" onClick={onClearSearch}>
          Clear search
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <InboxIcon className="size-8 text-muted-foreground" />
      <div className="grid gap-1">
        <p className="text-sm font-medium">No emails yet</p>
        <p className="text-sm text-muted-foreground">
          Point your app&apos;s SMTP settings at SendMock and send something.
        </p>
      </div>
      <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 rounded-md border bg-muted/40 px-4 py-2 text-left font-mono text-xs">
        <dt className="text-muted-foreground">Host</dt>
        <dd>127.0.0.1</dd>
        <dt className="text-muted-foreground">Port</dt>
        <dd>1025</dd>
        <dt className="text-muted-foreground">Auth / TLS</dt>
        <dd>none needed</dd>
      </dl>
      <Button
        size="sm"
        disabled={sendEmail.isPending}
        onClick={() => {
          sendEmail.mutate(sampleEmail, {
            onError: () => {
              toast.error("Could not send the sample email");
            },
          });
        }}
      >
        <SendIcon />
        Send a sample email
      </Button>
    </div>
  );
}
