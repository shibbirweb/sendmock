import { Link } from "@tanstack/react-router";

import {
  parseSmtpTranscript,
  type SmtpReplyClass,
  type SmtpTranscriptLine,
} from "@/features/logs/smtp/parse-smtp-transcript";
import { cn } from "@/lib/utils";

const replyClassStyles: Record<SmtpReplyClass, string> = {
  "2xx": "text-success",
  "3xx": "text-read-receipt",
  "4xx": "text-destructive",
  "5xx": "text-destructive font-semibold",
};

const speakerMarkers: Record<SmtpTranscriptLine["speaker"], string> = {
  client: "C",
  server: "S",
  note: "",
};

function TranscriptLineText({
  transcriptLine,
  firstEmailId,
}: {
  transcriptLine: SmtpTranscriptLine;
  firstEmailId: string | null;
}) {
  if (transcriptLine.speaker === "note") {
    return (
      <span className="text-muted-foreground italic">
        {transcriptLine.text}
      </span>
    );
  }
  if (transcriptLine.isMessagePlaceholder && firstEmailId !== null) {
    return (
      <Link
        to="/mail/$emailId"
        params={{ emailId: firstEmailId }}
        className="text-primary underline underline-offset-2"
      >
        {transcriptLine.text}
      </Link>
    );
  }
  if (transcriptLine.replyClass !== null) {
    return (
      <span>
        <span
          data-reply-class={transcriptLine.replyClass}
          className={replyClassStyles[transcriptLine.replyClass]}
        >
          {transcriptLine.text.slice(0, 3)}
        </span>
        {transcriptLine.text.slice(3)}
      </span>
    );
  }

  return (
    <span className={cn(transcriptLine.speaker === "client" && "font-medium")}>
      {transcriptLine.text}
    </span>
  );
}

/**
 * One line per command or reply: client lines marked C, server lines S with
 * the reply code coloured by class; the DATA placeholder links to the email.
 */
export function SmtpTranscript({
  transcript,
  firstEmailId,
}: {
  transcript: string;
  firstEmailId: string | null;
}) {
  const transcriptLines = parseSmtpTranscript(transcript);

  return (
    <ol
      aria-label="SMTP transcript"
      className="overflow-x-auto rounded-md border bg-muted/30 py-2 font-mono text-xs leading-relaxed"
    >
      {transcriptLines.map((transcriptLine, lineIndex) => (
        <li
          key={lineIndex}
          data-speaker={transcriptLine.speaker}
          className={cn(
            "flex gap-3 px-3 whitespace-pre",
            transcriptLine.speaker === "client" && "bg-background/60",
          )}
        >
          <span
            aria-hidden="true"
            className="w-3 shrink-0 text-muted-foreground select-none"
          >
            {speakerMarkers[transcriptLine.speaker]}
          </span>
          <TranscriptLineText
            transcriptLine={transcriptLine}
            firstEmailId={firstEmailId}
          />
        </li>
      ))}
    </ol>
  );
}
