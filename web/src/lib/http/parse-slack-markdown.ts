export type SlackTextSegment =
  | { segmentKind: "text"; text: string }
  | { segmentKind: "bold" | "italic" | "strike" | "code"; text: string }
  | { segmentKind: "link"; text: string; url: string };

const slackMarkdownPattern =
  /<(https?:\/\/[^|>]+)(?:\|([^>]+))?>|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~|`([^`\n]+)`/g;

/**
 * Slack mrkdwn as segments for safe rendering: *bold*, _italic_, ~strike~,
 * `code` and <url|label> links; anything else stays text (HC-03.2).
 */
export function parseSlackMarkdown(markdownText: string): SlackTextSegment[] {
  const segments: SlackTextSegment[] = [];
  let lastIndex = 0;
  for (const markdownMatch of markdownText.matchAll(slackMarkdownPattern)) {
    if (markdownMatch.index > lastIndex) {
      segments.push({
        segmentKind: "text",
        text: markdownText.slice(lastIndex, markdownMatch.index),
      });
    }
    const [, linkUrl, linkLabel, boldText, italicText, strikeText, codeText] =
      markdownMatch;
    if (linkUrl !== undefined) {
      segments.push({
        segmentKind: "link",
        url: linkUrl,
        text: linkLabel ?? linkUrl,
      });
    } else if (boldText !== undefined) {
      segments.push({ segmentKind: "bold", text: boldText });
    } else if (italicText !== undefined) {
      segments.push({ segmentKind: "italic", text: italicText });
    } else if (strikeText !== undefined) {
      segments.push({ segmentKind: "strike", text: strikeText });
    } else {
      segments.push({ segmentKind: "code", text: codeText ?? "" });
    }
    lastIndex = markdownMatch.index + markdownMatch[0].length;
  }
  if (lastIndex < markdownText.length) {
    segments.push({ segmentKind: "text", text: markdownText.slice(lastIndex) });
  }

  return segments;
}
