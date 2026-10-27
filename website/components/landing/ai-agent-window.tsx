"use client";

import {
  ArrowUpIcon,
  CheckCircle2Icon,
  SparklesIcon,
  TerminalSquareIcon,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";

import { AnimatedSpan, AnimationSequence } from "@/components/ui/terminal";

/** Room above a tall message for its "You" label. */
const youLabelHeightPx = 32;
/** Each message fades in after a short pause, like a reply arriving. */
const messageFadeIn = { duration: 0.4, delay: 0.7 };
/** The first reply waits longer, so the reader sees the prompt first. */
const firstReplyFadeIn = { duration: 0.4, delay: 2 };

/** Who wrote a message, above it, like an agent's chat shows it. */
function SpeakerLabel({ speaker }: { speaker: "you" | "agent" }) {
  return speaker === "you" ? (
    <span className="text-xs font-medium text-fd-muted-foreground">You</span>
  ) : (
    <span className="flex items-center gap-1.5 text-xs font-medium text-(--brand-text)">
      <SparklesIcon aria-hidden="true" className="size-3.5" />
      Agent
    </span>
  );
}

/** An agent message: its label, then what it says. */
function AgentMessage({
  children,
  isFirstReply = false,
}: {
  children: ReactNode;
  isFirstReply?: boolean;
}) {
  return (
    <AnimatedSpan
      transition={isFirstReply ? firstReplyFadeIn : messageFadeIn}
      className="gap-1 font-sans"
    >
      <SpeakerLabel speaker="agent" />
      <div className="flex flex-col gap-1.5">{children}</div>
    </AnimatedSpan>
  );
}

/** Your short answer to the agent. */
function YourAnswer({ children }: { children: string }) {
  return (
    <AnimatedSpan
      transition={messageFadeIn}
      className="max-w-[80%] self-end rounded-lg bg-fd-secondary px-3 py-1.5 font-sans"
    >
      {children}
    </AnimatedSpan>
  );
}

/**
 * The scroll position that shows a message: a short one with its bottom (and the
 * window's bottom padding) in view, a tall one (the prompt) from its "You" label.
 */
function findMessageScrollTop(
  scrollingBody: HTMLElement,
  message: HTMLElement,
) {
  const bottomPaddingPx = Number.parseFloat(
    getComputedStyle(scrollingBody).paddingBottom,
  );
  const isTallerThanWindow =
    message.offsetHeight + bottomPaddingPx > scrollingBody.clientHeight;

  return isTallerThanWindow
    ? message.offsetTop - youLabelHeightPx
    : message.offsetTop +
        message.offsetHeight +
        bottomPaddingPx -
        scrollingBody.clientHeight;
}

/**
 * Keeps the newest message in view while the run plays, until the reader
 * scrolls the window themselves. The fades run as browser animations, which
 * change no attribute to watch, so it checks once a frame which messages have
 * started to appear; messages not shown yet still take their space below.
 */
function useFollowNewestMessage(
  scrollingBodyRef: React.RefObject<HTMLDivElement | null>,
) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const scrollingBody = scrollingBodyRef.current;
    if (shouldReduceMotion || scrollingBody === null) {
      return;
    }

    let isFollowing = true;
    let followedScrollTop = scrollingBody.scrollTop;
    let animationFrameId = 0;
    const stopFollowing = () => {
      isFollowing = false;
    };
    const followNewestMessage = () => {
      if (!isFollowing) {
        return;
      }
      const messages = [...scrollingBody.children] as HTMLElement[];
      const shownMessages = messages.filter(
        (message) => Number(getComputedStyle(message).opacity) > 0,
      );
      const newestMessage = shownMessages.at(-1);
      if (newestMessage !== undefined) {
        const targetScrollTop = findMessageScrollTop(
          scrollingBody,
          newestMessage,
        );
        if (Math.abs(targetScrollTop - followedScrollTop) > 1) {
          followedScrollTop = targetScrollTop;
          scrollingBody.scrollTo({ top: targetScrollTop, behavior: "smooth" });
        }
      }
      const lastMessage = messages.at(-1);
      const isRunFinished =
        lastMessage !== undefined &&
        getComputedStyle(lastMessage).opacity === "1";
      if (!isRunFinished) {
        animationFrameId = requestAnimationFrame(followNewestMessage);
      }
    };
    animationFrameId = requestAnimationFrame(followNewestMessage);
    const readerEvents = ["wheel", "touchstart", "keydown"];
    for (const readerEvent of readerEvents) {
      scrollingBody.addEventListener(readerEvent, stopFollowing, {
        passive: true,
      });
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      for (const readerEvent of readerEvents) {
        scrollingBody.removeEventListener(readerEvent, stopFollowing);
      }
    };
  }, [shouldReduceMotion, scrollingBodyRef]);
}

/**
 * The quick start's AI tab (WS-09.4): an AI coding agent's window, not a plain
 * terminal. The whole Install with AI prompt fades in as your message, then the
 * agent checks the computer, asks Docker or the binary, asks before running the
 * install command and reports SendMock running. It fills the platform
 * terminals' height and scrolls inside.
 */
export function AiAgentWindow({ installPrompt }: { installPrompt: string }) {
  const scrollingBodyRef = useRef<HTMLDivElement | null>(null);
  useFollowNewestMessage(scrollingBodyRef);

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
        <AnimationSequence>
          <AnimatedSpan className="font-sans">
            <SpeakerLabel speaker="you" />
          </AnimatedSpan>
          <AnimatedSpan className="-mt-2 min-w-0 rounded-lg border bg-fd-secondary/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
            {installPrompt}
          </AnimatedSpan>
          <AgentMessage isFirstReply>
            <p>
              I checked this computer: macOS on Apple silicon, Docker is running
              and Homebrew is installed.
            </p>
          </AgentMessage>
          <AgentMessage>
            <p className="font-medium">How do you want to run SendMock?</p>
            <p>
              <span className="font-medium">Docker or the binary?</span> Docker
              keeps your computer clean and is easy to remove. The binary starts
              instantly and needs no Docker.
            </p>
          </AgentMessage>
          <YourAnswer>The binary, stable</YourAnswer>
          <AgentMessage>
            <div className="flex flex-col gap-1 rounded-lg border p-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-fd-muted-foreground">
                <TerminalSquareIcon aria-hidden="true" className="size-3.5" />
                Run command
              </span>
              <code className="font-mono text-xs break-all">
                brew install shibbirweb/tap/sendmock
              </code>
              <span className="text-xs text-fd-muted-foreground">
                Installs the stable SendMock with Homebrew. OK to run?
              </span>
            </div>
          </AgentMessage>
          <YourAnswer>OK</YourAnswer>
          <AgentMessage>
            <p className="flex items-center gap-1.5 font-medium text-(--brand-text)">
              <CheckCircle2Icon aria-hidden="true" className="size-4" />
              SendMock is running
            </p>
            <p className="text-fd-muted-foreground">
              Web UI http://127.0.0.1:8025 · SMTP 127.0.0.1:1025
            </p>
          </AgentMessage>
        </AnimationSequence>
      </div>
      <div
        aria-hidden="true"
        className="flex items-center gap-2 border-t px-4 py-2.5 text-fd-muted-foreground"
      >
        <span className="flex-1 text-xs">Message your agent…</span>
        <span className="flex size-6 items-center justify-center rounded-full bg-fd-primary text-fd-primary-foreground">
          <ArrowUpIcon className="size-3.5" />
        </span>
      </div>
    </div>
  );
}
