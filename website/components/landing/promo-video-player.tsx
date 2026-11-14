"use client";

import { PlayIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

type PromoVideoPlayerProps = {
  youtubeVideoId: string;
  videoTitle: string;
  /** The poster shown until play is pressed. */
  children: ReactNode;
};

/**
 * Shows the poster with a play button; pressing it swaps in the YouTube
 * player. Nothing loads from YouTube before the press, and the player comes
 * from youtube-nocookie.com, so the page sets no third-party cookies.
 */
export function PromoVideoPlayer({
  youtubeVideoId,
  videoTitle,
  children,
}: PromoVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (isPlaying) {
    return (
      <div
        data-testid="promo-video-player"
        className="aspect-video w-full overflow-hidden rounded-xl border bg-black"
      >
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1&rel=0`}
          title={videoTitle}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="size-full"
        />
      </div>
    );
  }

  return (
    <div
      data-testid="promo-video-poster"
      className="relative w-full overflow-hidden rounded-xl"
    >
      {children}
      <div
        aria-hidden
        className="absolute inset-0 z-20 bg-linear-to-t from-fd-background/80 via-fd-background/40 to-fd-background/20"
      />
      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <button
          type="button"
          aria-label="Play the video"
          onClick={() => {
            setIsPlaying(true);
          }}
          className="flex size-20 items-center justify-center rounded-full bg-linear-to-br from-(--brand-from) to-(--brand-to) text-white shadow-xl ring-8 ring-fd-background/60 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <PlayIcon aria-hidden className="ms-1 size-8 fill-current" />
        </button>
      </div>
    </div>
  );
}
