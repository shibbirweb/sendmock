import { BotIcon } from "lucide-react";

import type {
  DiscordEmbedPreview,
  MessagePreview,
} from "@/lib/http/message-preview-types";

function DiscordEmbed({ discordEmbed }: { discordEmbed: DiscordEmbedPreview }) {
  return (
    <div
      data-testid="discord-embed"
      className="grid max-w-md gap-1.5 rounded border-l-4 border-l-border bg-muted/50 p-3"
      // The colour bar is the payload's own colour.
      style={
        discordEmbed.colorHex === null
          ? undefined
          : { borderLeftColor: discordEmbed.colorHex }
      }
    >
      {discordEmbed.authorName !== null && (
        <p className="text-xs font-semibold">{discordEmbed.authorName}</p>
      )}
      {discordEmbed.title !== null && (
        <p className="font-semibold">{discordEmbed.title}</p>
      )}
      {discordEmbed.description !== null && (
        <p className="whitespace-pre-wrap">{discordEmbed.description}</p>
      )}
      {discordEmbed.fields.length > 0 && (
        <dl className="grid grid-cols-3 gap-2">
          {discordEmbed.fields.map((embedField) => (
            <div
              key={embedField.name}
              className={embedField.isInline ? "" : "col-span-3"}
            >
              <dt className="text-xs font-semibold">{embedField.name}</dt>
              <dd className="text-xs">{embedField.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {discordEmbed.footerText !== null && (
        <p className="text-[11px] text-muted-foreground">
          {discordEmbed.footerText}
        </p>
      )}
    </div>
  );
}

/** A Discord webhook message with its embeds, as Discord shows it (HC-03.2). */
export function DiscordMessagePreview({
  discordMessage,
}: {
  discordMessage: Extract<MessagePreview, { previewKind: "discord" }>;
}) {
  return (
    <article
      aria-label="Discord message"
      className="flex gap-3 rounded-md border bg-card p-3 text-sm"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <BotIcon aria-hidden="true" className="size-4" />
      </span>
      <div className="grid min-w-0 flex-1 gap-2">
        <p className="flex items-center gap-2">
          <span className="font-semibold">
            {discordMessage.username ?? "Webhook"}
          </span>
          <span className="rounded bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            BOT
          </span>
        </p>
        {discordMessage.content !== null && (
          <p className="whitespace-pre-wrap">{discordMessage.content}</p>
        )}
        {discordMessage.embeds.map((discordEmbed, embedIndex) => (
          <DiscordEmbed key={embedIndex} discordEmbed={discordEmbed} />
        ))}
      </div>
    </article>
  );
}
