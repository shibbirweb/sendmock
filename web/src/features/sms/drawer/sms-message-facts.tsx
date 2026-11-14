import type * as React from "react";

import { CopyButton } from "@/components/common/copy-button";
import { ProviderBadge } from "@/features/providers/provider-badge";
import { labelSmsApi } from "@/features/sms/sms-labels";
import { stripChannelPrefix } from "@/lib/sms/format-phone-number";
import type { SmsMessageDetail } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";

function SmsFact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1 break-all">{children}</dd>
    </div>
  );
}

/** Who sent the message to whom, through which API, and its IDs. */
export function SmsMessageFacts({
  smsMessage,
}: {
  smsMessage: SmsMessageDetail;
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
      <SmsFact label="From">
        {stripChannelPrefix(smsMessage.from_number)}
      </SmsFact>
      <SmsFact label="To">{stripChannelPrefix(smsMessage.to_number)}</SmsFact>
      <SmsFact label="Channel">
        {smsMessage.channel === "whatsapp" ? "WhatsApp" : "SMS"},{" "}
        {smsMessage.direction}
      </SmsFact>
      <SmsFact label="API">
        {smsMessage.api === "native" ? (
          labelSmsApi(smsMessage.api)
        ) : (
          <ProviderBadge providerArea="sms" providerKey={smsMessage.api} />
        )}
      </SmsFact>
      <SmsFact label="Message ID">
        <span className="truncate font-mono text-xs">
          {smsMessage.provider_id}
        </span>
        <CopyButton
          copyText={smsMessage.provider_id}
          label="Copy message ID"
          className="size-6"
        />
      </SmsFact>
      {smsMessage.messaging_service_sid !== null && (
        <SmsFact label="Messaging Service">
          <span className="truncate font-mono text-xs">
            {smsMessage.messaging_service_sid}
          </span>
        </SmsFact>
      )}
      <SmsFact label="Segments">
        {smsMessage.segments}, {smsMessage.encoding}
      </SmsFact>
      <SmsFact label="Created">{formatDateTime(smsMessage.created_at)}</SmsFact>
    </dl>
  );
}
