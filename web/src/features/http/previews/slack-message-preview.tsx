import { WebhookIcon } from "lucide-react";

import { SlackMarkdownText } from "@/features/http/previews/slack-markdown-text";
import type {
  MessagePreview,
  SlackBlockPreview,
} from "@/lib/http/message-preview-types";

function SlackBlock({ slackBlock }: { slackBlock: SlackBlockPreview }) {
  if (slackBlock.blockKind === "header") {
    return <p className="text-base font-bold">{slackBlock.text}</p>;
  }
  if (slackBlock.blockKind === "divider") {
    return <hr className="border-border" />;
  }
  if (slackBlock.blockKind === "context") {
    return (
      <p className="text-xs text-muted-foreground">
        {slackBlock.texts.map((contextText) => (
          <SlackMarkdownText key={contextText} markdownText={contextText} />
        ))}
      </p>
    );
  }
  if (slackBlock.blockKind === "actions") {
    return (
      <div className="flex flex-wrap gap-2">
        {slackBlock.buttonLabels.map((buttonLabel) => (
          <span
            key={buttonLabel}
            className="rounded border px-3 py-1 text-xs font-medium"
          >
            {buttonLabel}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {slackBlock.text !== null && (
        <p>
          <SlackMarkdownText markdownText={slackBlock.text} />
        </p>
      )}
      {slackBlock.fields.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {slackBlock.fields.map((fieldText) => (
            <p key={fieldText}>
              <SlackMarkdownText markdownText={fieldText} />
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** A Slack incoming-webhook message as Slack shows it (HC-03.2). */
export function SlackMessagePreview({
  slackMessage,
}: {
  slackMessage: Extract<MessagePreview, { previewKind: "slack" }>;
}) {
  return (
    <article
      aria-label="Slack message"
      className="flex gap-3 rounded-md border bg-card p-3 text-sm"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <WebhookIcon aria-hidden="true" className="size-4" />
      </span>
      <div className="grid min-w-0 flex-1 gap-2">
        <p className="flex items-center gap-2">
          <span className="font-bold">Incoming webhook</span>
          <span className="rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
            APP
          </span>
        </p>
        {slackMessage.blocks.length === 0 && slackMessage.text !== null && (
          <p>
            <SlackMarkdownText markdownText={slackMessage.text} />
          </p>
        )}
        {slackMessage.blocks.map((slackBlock, blockIndex) => (
          <SlackBlock key={blockIndex} slackBlock={slackBlock} />
        ))}
      </div>
    </article>
  );
}
