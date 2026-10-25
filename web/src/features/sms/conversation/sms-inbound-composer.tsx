import { PaperclipIcon, SendHorizontalIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ComposerMediaChips } from "@/features/sms/media/composer-media-chips";
import { useComposerMedia } from "@/features/sms/media/use-composer-media";
import { useSendInboundSms } from "@/lib/api/hooks/use-sms-queries";
import type { SmsThread } from "@/lib/api/types";
import { calculateSmsSegments } from "@/lib/sms/calculate-sms-segments";
import { stripChannelPrefix } from "@/lib/sms/format-phone-number";

/**
 * "Reply as recipient": simulates the other party texting the app, which
 * stores an inbound message and fires `sms.inbound` (SM-09.1). Files can be
 * attached as MMS or WhatsApp media (SM-15.5).
 */
export function SmsInboundComposer({ smsThread }: { smsThread: SmsThread }) {
  const sendInboundSms = useSendInboundSms();
  const composerMedia = useComposerMedia();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [replyText, setReplyText] = React.useState("");
  const segmentInfo = calculateSmsSegments(replyText);
  const hasMedia = composerMedia.mediaFiles.length > 0;
  const canSend =
    (replyText.trim() !== "" || hasMedia) && !sendInboundSms.isPending;
  const contactNumber = stripChannelPrefix(smsThread.contact_number);

  const sendReply = async () => {
    if (!canSend) {
      return;
    }

    const inlineMedia = await composerMedia.readAsInlineMedia();
    sendInboundSms.mutate(
      {
        from: smsThread.contact_number,
        to: smsThread.app_number,
        body: replyText,
        channel: smsThread.channel,
        media: inlineMedia.length > 0 ? inlineMedia : undefined,
      },
      {
        onSuccess: () => {
          setReplyText("");
          composerMedia.clearFiles();
        },
        onError: () => {
          toast.error("Could not simulate the reply");
        },
      },
    );
  };

  return (
    <form
      className="grid gap-1.5 border-t px-4 py-3 sm:px-6"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        void sendReply();
      }}
    >
      <ComposerMediaChips
        mediaFiles={composerMedia.mediaFiles}
        onRemove={composerMedia.removeFile}
      />
      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Attach files"
          onClick={() => fileInputRef.current?.click()}
        >
          <PaperclipIcon />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          aria-label="Choose files to attach"
          onChange={(changeEvent) => {
            composerMedia.addFiles([...(changeEvent.target.files ?? [])]);
            changeEvent.target.value = "";
          }}
        />
        <Textarea
          value={replyText}
          onChange={(changeEvent) => {
            setReplyText(changeEvent.target.value);
          }}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === "Enter" && !keyboardEvent.shiftKey) {
              keyboardEvent.preventDefault();
              void sendReply();
            }
          }}
          rows={1}
          placeholder={`Reply as ${contactNumber}`}
          aria-label={`Reply as ${contactNumber}`}
          className="max-h-40 min-h-9 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          aria-label="Send reply"
        >
          <SendHorizontalIcon />
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Simulates an inbound message from {contactNumber}.{" "}
        {segmentInfo.unitCount} /{" "}
        {segmentInfo.unitsPerSegment * segmentInfo.segmentCount},{" "}
        {segmentInfo.segmentCount} segment
        {segmentInfo.segmentCount === 1 ? "" : "s"}, {segmentInfo.encoding}.
        Enter sends, Shift+Enter adds a line.
      </p>
    </form>
  );
}
