"use client";

import { ArrowUpIcon, SparklesIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";

import { cn } from "@/lib/utils";

import {
  buildConversation,
  ConversationMessage,
  ThinkingIndicator,
} from "./ai-agent-conversation";
import { useAgentTimeline } from "./use-agent-timeline";

/** Room above a tall message for its "You" label. */
const youLabelHeightPx = 24;

/**
 * Brings the newest message into view: a short one fully, with the window's
 * bottom padding, a tall one (the prompt) from its "You" label. Stops once the
 * reader scrolls the window themselves.
 */
function useFollowNewestMessage(
  scrollingBodyRef: React.RefObject<HTMLDivElement | null>,
  /** Changes whenever a message or the thinking line is added or replaced. */
  conversationStep: string,
) {
  const shouldReduceMotion = useReducedMotion();
  const isFollowingRef = useRef(true);

  useEffect(() => {
    const scrollingBody = scrollingBodyRef.current;
    if (scrollingBody === null) {
      return;
    }
    const stopFollowing = () => {
      isFollowingRef.current = false;
    };
    const readerEvents = ["wheel", "touchstart", "keydown"];
    for (const readerEvent of readerEvents) {
      scrollingBody.addEventListener(readerEvent, stopFollowing, {
        passive: true,
      });
    }

    return () => {
      for (const readerEvent of readerEvents) {
        scrollingBody.removeEventListener(readerEvent, stopFollowing);
      }
    };
  }, [scrollingBodyRef]);

  useEffect(() => {
    const scrollingBody = scrollingBodyRef.current;
    const newestMessage = scrollingBody?.lastElementChild as HTMLElement | null;
    if (
      shouldReduceMotion ||
      !isFollowingRef.current ||
      scrollingBody === null ||
      scrollingBody === undefined ||
      newestMessage === null
    ) {
      return;
    }
    const isTallerThanWindow =
      newestMessage.offsetHeight > scrollingBody.clientHeight;
    scrollingBody.scrollTo({
      top: isTallerThanWindow
        ? newestMessage.offsetTop - youLabelHeightPx
        : scrollingBody.scrollHeight,
      behavior: "smooth",
    });
  }, [scrollingBodyRef, conversationStep, shouldReduceMotion]);
}

/** The message box: what you paste or type before it is sent. */
function MessageComposer({
  composerText,
  isComposerPasted,
}: {
  composerText: string;
  isComposerPasted: boolean;
}) {
  const hasText = composerText !== "";
  const pastedLineCount = composerText.split("\n").length;

  return (
    <div
      aria-hidden="true"
      data-testid="quick-start-ai-composer"
      className="flex items-end gap-2 border-t px-4 py-2.5"
    >
      <div className="flex min-w-0 flex-1 flex-col text-xs">
        {!hasText && (
          <span className="text-fd-muted-foreground">Message your agent…</span>
        )}
        {hasText && isComposerPasted && (
          <>
            <span className="truncate font-mono">
              {composerText.split("\n")[0]}
            </span>
            <span className="text-fd-muted-foreground">
              Pasted text, {pastedLineCount} lines
            </span>
          </>
        )}
        {hasText && !isComposerPasted && (
          <span>
            {composerText}
            <span className="ml-px inline-block h-3.5 w-px animate-pulse bg-fd-foreground align-middle" />
          </span>
        )}
      </div>
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
          hasText
            ? "bg-fd-primary text-fd-primary-foreground"
            : "bg-fd-muted text-fd-muted-foreground",
        )}
      >
        <ArrowUpIcon className="size-3.5" />
      </span>
    </div>
  );
}

/**
 * The quick start's AI tab (WS-09.4): an AI coding agent's window, not a plain
 * terminal. Your whole prompt is pasted into the message box and sent, the
 * agent checks the computer and asks Docker or the binary, your answers are
 * typed and sent, and it asks before running the install. It fills the
 * platform terminals' height and scrolls inside.
 */
export function AiAgentWindow({ installPrompt }: { installPrompt: string }) {
  const conversation = useMemo(
    () => buildConversation(installPrompt),
    [installPrompt],
  );
  const { shownMessageCount, composerText, isComposerPasted, isThinking } =
    useAgentTimeline(conversation);
  const scrollingBodyRef = useRef<HTMLDivElement | null>(null);
  // The reply replaces the thinking line, so the count alone would not change.
  useFollowNewestMessage(
    scrollingBodyRef,
    `${shownMessageCount}:${isThinking ? "thinking" : "shown"}`,
  );

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border bg-fd-background text-sm">
      {/* The terminal's title bar size: its p-4 around the 8px dots, so every tab's window lines up. */}
      <div className="box-content flex h-2 items-center gap-3 border-b p-4">
        <div aria-hidden="true" className="flex gap-x-2">
          <span className="size-2 rounded-full bg-red-500" />
          <span className="size-2 rounded-full bg-yellow-500" />
          <span className="size-2 rounded-full bg-green-500" />
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <SparklesIcon
            aria-hidden="true"
            className="size-3.5 text-(--brand-text)"
          />
          AI coding agent
        </span>
      </div>
      <div
        ref={scrollingBodyRef}
        data-testid="quick-start-ai-conversation"
        className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-4"
      >
        {conversation
          .slice(0, shownMessageCount)
          .map((conversationEntry, entryIndex) => (
            <motion.div
              key={entryIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex min-w-0 flex-col"
            >
              <ConversationMessage conversationEntry={conversationEntry} />
            </motion.div>
          ))}
        {isThinking && <ThinkingIndicator />}
      </div>
      <MessageComposer
        composerText={composerText}
        isComposerPasted={isComposerPasted}
      />
    </div>
  );
}
