import { MessageCircleIcon, UserRoundIcon } from "lucide-react";

import type { SmsChannel } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** Phone-style round avatar; WhatsApp threads get a small channel mark. */
export function SmsContactAvatar({
  channel,
  className,
}: {
  channel: SmsChannel;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
        className,
      )}
    >
      <UserRoundIcon className="size-5" />
      {channel === "whatsapp" && (
        <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-whatsapp-outbound text-whatsapp-outbound-foreground ring-2 ring-background">
          <MessageCircleIcon className="size-2.5" />
        </span>
      )}
    </span>
  );
}
