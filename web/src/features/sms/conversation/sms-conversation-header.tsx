import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

import { CopyButton } from "@/components/common/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmsContactAvatar } from "@/features/sms/sms-contact-avatar";
import type { SmsThread } from "@/lib/api/types";
import { stripChannelPrefix } from "@/lib/sms/format-phone-number";

/** Who the conversation is with, which app number it uses and the channel. */
export function SmsConversationHeader({ smsThread }: { smsThread: SmsThread }) {
  const contactNumber = stripChannelPrefix(smsThread.contact_number);

  return (
    <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-6">
      <Button variant="ghost" size="icon" className="-ml-2 md:hidden" asChild>
        <Link to="/sms" aria-label="Back to the list">
          <ArrowLeftIcon />
        </Link>
      </Button>
      <SmsContactAvatar channel={smsThread.channel} />
      <div className="grid min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1">
          <h2 className="truncate text-base font-semibold">{contactNumber}</h2>
          <CopyButton
            copyText={contactNumber}
            label="Copy phone number"
            className="size-6"
          />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          with {stripChannelPrefix(smsThread.app_number)},{" "}
          {smsThread.message_count} message
          {smsThread.message_count === 1 ? "" : "s"}
        </p>
      </div>
      <Badge variant="outline">
        {smsThread.channel === "whatsapp" ? "WhatsApp" : "SMS"}
      </Badge>
    </header>
  );
}
