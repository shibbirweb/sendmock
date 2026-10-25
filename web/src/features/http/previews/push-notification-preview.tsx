import { BellIcon } from "lucide-react";

import type { MessagePreview } from "@/lib/http/message-preview-types";

function shortenTarget(target: string): string {
  return target.length > 18
    ? `${target.slice(0, 8)}...${target.slice(-6)}`
    : target;
}

/** Push notifications as cards on a phone lock screen (HC-03.2). */
export function PushNotificationPreview({
  pushMessage,
}: {
  pushMessage: Extract<MessagePreview, { previewKind: "push" }>;
}) {
  return (
    <div className="grid justify-items-center rounded-2xl border bg-muted/40 px-4 py-6">
      <ul
        aria-label="Push notifications"
        className="grid w-full max-w-sm gap-2"
      >
        {pushMessage.notifications.map(
          (pushNotification, notificationIndex) => (
            <li
              key={notificationIndex}
              className="flex gap-3 rounded-2xl border bg-card p-3 text-sm shadow-xs"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <BellIcon aria-hidden="true" className="size-4" />
              </span>
              <div className="grid min-w-0 flex-1 gap-0.5">
                <p className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>
                    {pushNotification.service}
                    {pushNotification.target === null
                      ? ""
                      : ` to ${shortenTarget(pushNotification.target)}`}
                  </span>
                  <span>now</span>
                </p>
                <p className="font-semibold">{pushNotification.title}</p>
                <p className="text-muted-foreground">{pushNotification.body}</p>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
