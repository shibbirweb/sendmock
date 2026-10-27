"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import type { ConversationEntry } from "./ai-agent-conversation";

/** How long a pasted prompt sits in the message box before it is sent. */
const pastedHoldMs = 1200;
/** Your answers are typed one letter at a time. */
const typedLetterMs = 70;
const typedHoldMs = 450;
/** The agent thinks for a moment before each reply. */
const thinkingMs = 1100;
const afterMessageMs = 500;

export type AgentTimeline = {
  /** How many conversation entries have been sent or answered. */
  shownMessageCount: number;
  /** What is in the message box now. */
  composerText: string;
  isComposerPasted: boolean;
  isThinking: boolean;
};

/**
 * Plays the agent run: each of your messages is pasted or typed into the
 * message box and sent, and the agent thinks before each reply. With reduced
 * motion the whole conversation is shown at once.
 */
export function useAgentTimeline(
  conversation: ConversationEntry[],
): AgentTimeline {
  const shouldReduceMotion = useReducedMotion();
  const [timeline, setTimeline] = useState<AgentTimeline>({
    shownMessageCount: 0,
    composerText: "",
    isComposerPasted: false,
    isThinking: false,
  });

  useEffect(() => {
    if (shouldReduceMotion) {
      setTimeline({
        shownMessageCount: conversation.length,
        composerText: "",
        isComposerPasted: false,
        isThinking: false,
      });
      return;
    }

    let isCancelled = false;
    const pendingTimers: ReturnType<typeof setTimeout>[] = [];
    const wait = (durationMs: number) =>
      new Promise<void>((resolve) => {
        pendingTimers.push(setTimeout(resolve, durationMs));
      });
    const updateTimeline = (timelineChange: Partial<AgentTimeline>) => {
      if (!isCancelled) {
        setTimeline((current) => ({ ...current, ...timelineChange }));
      }
    };

    const playConversation = async () => {
      for (const [entryIndex, conversationEntry] of conversation.entries()) {
        if (conversationEntry.speaker === "agent") {
          updateTimeline({ isThinking: true });
          await wait(thinkingMs);
        } else if (conversationEntry.isPasted) {
          updateTimeline({
            composerText: conversationEntry.text,
            isComposerPasted: true,
          });
          await wait(pastedHoldMs);
        } else {
          for (
            let letterCount = 1;
            letterCount <= conversationEntry.text.length;
            letterCount += 1
          ) {
            updateTimeline({
              composerText: conversationEntry.text.slice(0, letterCount),
              isComposerPasted: false,
            });
            await wait(typedLetterMs);
          }
          await wait(typedHoldMs);
        }
        if (isCancelled) {
          return;
        }
        updateTimeline({
          shownMessageCount: entryIndex + 1,
          composerText: "",
          isComposerPasted: false,
          isThinking: false,
        });
        await wait(afterMessageMs);
      }
    };
    void playConversation();

    return () => {
      isCancelled = true;
      for (const pendingTimer of pendingTimers) {
        clearTimeout(pendingTimer);
      }
    };
  }, [conversation, shouldReduceMotion]);

  return timeline;
}
