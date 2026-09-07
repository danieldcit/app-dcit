"use client";

import { useEffect, useRef } from "react";

import styles from "./onboarding.module.css";

const VIDEO_ID = "9US-Rv6-354";

// Just the slice of the YouTube IFrame Player API this component touches —
// not worth pulling in @types/youtube for three methods and one event shape.
type YouTubePlayer = {
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
};

type YouTubePlayerEvent = { data: number };

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string;
          playerVars?: Record<string, number>;
          events?: {
            onReady?: () => void;
            onStateChange?: (event: YouTubePlayerEvent) => void;
          };
        },
      ) => YouTubePlayer;
      PlayerState: { ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// The IFrame API script and its ready-callback are global (shared across any
// number of instances/mounts) — never inject a second <script>, and chain
// onto any onYouTubeIframeAPIReady that's already set rather than clobbering
// it, in case something else on the page also depends on that callback.
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
    }
  });
}

// Enforced no-skip-ahead: polls playback position and snaps back any jump
// past the furthest point actually watched. YouTube's own scrubber UI still
// lets a viewer drag the handle — this just immediately reverts it, so
// skipping ahead never sticks. The tolerance absorbs the normal per-poll
// advance during ordinary playback so it isn't mistaken for a seek.
const POLL_INTERVAL_MS = 500;
const SEEK_TOLERANCE_SECONDS = 1.5;

export function WelcomeVideoPlayer({ onCompleted }: { onCompleted: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Read via a ref inside the effect instead of listing onCompleted as a
  // dependency — the caller passes a fresh inline function every render, and
  // re-running this effect would tear down and recreate the YouTube player
  // (losing playback) on every parent re-render.
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  useEffect(() => {
    let cancelled = false;
    let player: YouTubePlayer | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let maxWatchedSeconds = 0;

    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      const YT = window.YT;
      player = new YT.Player(containerRef.current, {
        videoId: VIDEO_ID,
        playerVars: { modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            pollId = setInterval(() => {
              if (!player) return;
              const current = player.getCurrentTime();
              if (current > maxWatchedSeconds + SEEK_TOLERANCE_SECONDS) {
                player.seekTo(maxWatchedSeconds, true);
              } else {
                maxWatchedSeconds = Math.max(maxWatchedSeconds, current);
              }
            }, POLL_INTERVAL_MS);
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              onCompletedRef.current();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      player?.destroy();
    };
  }, []);

  return (
    <div className={styles.videoWrapper}>
      <div ref={containerRef} />
    </div>
  );
}
