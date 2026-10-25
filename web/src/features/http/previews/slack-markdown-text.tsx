import { parseSlackMarkdown } from "@/lib/http/parse-slack-markdown";

/** Slack mrkdwn rendered as React elements, never as HTML. */
export function SlackMarkdownText({ markdownText }: { markdownText: string }) {
  return (
    <span className="whitespace-pre-wrap">
      {parseSlackMarkdown(markdownText).map((textSegment, segmentIndex) => {
        const segmentKey = `${segmentIndex}-${textSegment.segmentKind}`;
        if (textSegment.segmentKind === "bold") {
          return <strong key={segmentKey}>{textSegment.text}</strong>;
        }
        if (textSegment.segmentKind === "italic") {
          return <em key={segmentKey}>{textSegment.text}</em>;
        }
        if (textSegment.segmentKind === "strike") {
          return <s key={segmentKey}>{textSegment.text}</s>;
        }
        if (textSegment.segmentKind === "code") {
          return (
            <code
              key={segmentKey}
              className="rounded border bg-muted px-1 font-mono text-[0.85em] text-destructive"
            >
              {textSegment.text}
            </code>
          );
        }
        if (textSegment.segmentKind === "link") {
          return (
            <a
              key={segmentKey}
              href={textSegment.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              {textSegment.text}
            </a>
          );
        }
        return <span key={segmentKey}>{textSegment.text}</span>;
      })}
    </span>
  );
}
