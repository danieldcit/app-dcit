"use client";

import { useEffect, useRef } from "react";

const VIDEO_ID = "9US-Rv6-354";

// Same slice of the YouTube IFrame Player API as the in-app onboarding video
// player (apps/web/.../onboarding/welcome-video-player.tsx).
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
          width?: string;
          height?: string;
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
    ReactNativeWebView?: { postMessage: (data: string) => void };
  }
}

const POLL_INTERVAL_MS = 500;
const SEEK_TOLERANCE_SECONDS = 1.5;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = resolve;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(script);
  });
}

// A standalone, unauthenticated page (outside the `(app)` route group) whose
// only job is playing the onboarding video — the mobile app's WebView
// navigates here directly instead of injecting a synthetic HTML blob.
// YouTube's embed authorization is checked against real document/origin
// state, which only a genuine server-rendered page over a real origin
// satisfies; injected HTML with any baseUrl (youtube.com itself, or a made-up
// domain) either got rejected outright ("Error 152") or silently degraded to
// YouTube's non-interactive "Watch on YouTube" fallback card. This page
// reuses the exact code path the browser web app already plays the video
// with successfully, instead of continuing to fight embed authorization from
// inside a WebView blob.
export function OnboardingVideoEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let player: YouTubePlayer | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
    const params = new URLSearchParams(window.location.search);
    let maxWatchedSeconds = Number(params.get("progress")) || 0;

    function post(message: Record<string, unknown>) {
      window.ReactNativeWebView?.postMessage(JSON.stringify(message));
    }

    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      const YT = window.YT;
      player = new YT.Player(containerRef.current, {
        videoId: VIDEO_ID,
        width: "100%",
        height: "100%",
        playerVars: { modestbranding: 1, rel: 0, playsinline: 1, fs: 1 },
        events: {
          onReady: () => {
            if (maxWatchedSeconds > SEEK_TOLERANCE_SECONDS) {
              player?.seekTo(maxWatchedSeconds, true);
            }
            pollId = setInterval(() => {
              if (!player) return;
              const current = player.getCurrentTime();
              if (current > maxWatchedSeconds + SEEK_TOLERANCE_SECONDS) {
                player.seekTo(maxWatchedSeconds, true);
              } else {
                maxWatchedSeconds = Math.max(maxWatchedSeconds, current);
                post({ type: "progress", seconds: maxWatchedSeconds });
              }
            }, POLL_INTERVAL_MS);
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              post({ type: "ended" });
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

  return <div ref={containerRef} style={{ width: "100vw", height: "100vh", background: "#000" }} />;
}
