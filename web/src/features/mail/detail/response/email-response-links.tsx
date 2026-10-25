import { Link } from "@tanstack/react-router";
import { ForwardIcon, InboxIcon, ReplyIcon } from "lucide-react";

import type { EmailDetail, EmailResponseKind } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/format/format-values";

const responseKindIcons: Record<EmailResponseKind, typeof ReplyIcon> = {
  reply: ReplyIcon,
  forward: ForwardIcon,
};

const responseToLabels: Record<EmailResponseKind, string> = {
  reply: "Reply to",
  forward: "Forward of",
};

/** On an incoming email: what it answers, and how it reaches the app. */
function EmailResponseOrigin({ email }: { email: EmailDetail }) {
  const responseTo = email.response_to;

  return (
    <div className="grid gap-1 rounded-md border border-dashed px-3 py-2 text-sm">
      {responseTo !== null && (
        <p className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-muted-foreground">
            {responseToLabels[responseTo.kind]}:
          </span>
          <Link
            to="/mail/$emailId"
            params={{ emailId: responseTo.email_id }}
            search={(previousSearch) => previousSearch}
            className="min-w-0 truncate font-medium hover:underline"
          >
            {responseTo.subject || "(no subject)"}
          </Link>
        </p>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <InboxIcon className="size-3.5 shrink-0" />
        An incoming email (<code>email.inbound</code>). Inbound routes deliver
        it to your app; they arrive with the webhook screens.
      </p>
    </div>
  );
}

/** On an email your app sent: the replies and forwards made from it (EM-17.5). */
function EmailResponseList({ email }: { email: EmailDetail }) {
  return (
    <nav
      aria-label="Replies and forwards"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
    >
      <span className="text-muted-foreground">Replies and forwards:</span>
      {email.responses.map((responseLink) => {
        const ResponseIcon = responseKindIcons[responseLink.kind];

        return (
          <Link
            key={responseLink.email_id}
            to="/mail/$emailId"
            params={{ emailId: responseLink.email_id }}
            search={(previousSearch) => previousSearch}
            className="flex items-center gap-1 hover:underline"
          >
            <ResponseIcon className="size-3.5 text-muted-foreground" />
            <span>{responseLink.from.name || responseLink.from.address}</span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(responseLink.received_at)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Links between an original email and its replies or forwards. */
export function EmailResponseLinks({ email }: { email: EmailDetail }) {
  if (email.direction === "inbound") {
    return <EmailResponseOrigin email={email} />;
  }
  if (email.responses.length === 0) {
    return null;
  }

  return <EmailResponseList email={email} />;
}
