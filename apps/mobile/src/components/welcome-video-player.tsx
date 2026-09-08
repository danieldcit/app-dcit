import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/hooks/use-theme";

// Same video as the web version (apps/web/.../onboarding/welcome-video-player.tsx).
const VIDEO_ID = "9US-Rv6-354";
const PROGRESS_STORAGE_KEY = `onboarding-video-progress:${VIDEO_ID}`;

function buildPlayerHtml(initialProgress: number): string {
  return `
<!DOCTYPE html><html><body style="margin:0;background:#000">
  <div id="player"></div>
  <script src="https://www.youtube.com/iframe_api"></script>
  <script>
    var player;
    var maxWatched = ${initialProgress};
    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        videoId: '${VIDEO_ID}',
        width: '100%',
        height: '220',
        playerVars: { modestbranding: 1, rel: 0 },
        events: {
          onReady: function() {
            if (maxWatched > 1.5) player.seekTo(maxWatched, true);
            setInterval(function() {
              var current = player.getCurrentTime();
              if (current > maxWatched + 1.5) {
                player.seekTo(maxWatched, true);
              } else {
                maxWatched = Math.max(maxWatched, current);
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', seconds: maxWatched }));
              }
            }, 500);
          },
          onStateChange: function(event) {
            if (event.data === YT.PlayerState.ENDED) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' }));
            }
          }
        }
      });
    }
  </script>
</body></html>`;
}

// The RN WebView doesn't share the app's own storage with the page it
// loads — the YouTube IFrame page's "window" is its own isolated context,
// so progress travels out via postMessage into AsyncStorage instead of the
// web version's direct window.localStorage read/write.
export function WelcomeVideoPlayer({ onCompleted }: { onCompleted: () => void }) {
  const theme = useTheme();
  const [initialProgress, setInitialProgress] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(PROGRESS_STORAGE_KEY).then((value) => {
      if (!cancelled) setInitialProgress(Number(value) || 0);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleMessage(event: WebViewMessageEvent) {
    const data = JSON.parse(event.nativeEvent.data) as { type: string; seconds?: number };
    if (data.type === "progress" && data.seconds !== undefined) {
      AsyncStorage.setItem(PROGRESS_STORAGE_KEY, String(data.seconds));
    } else if (data.type === "ended") {
      AsyncStorage.removeItem(PROGRESS_STORAGE_KEY);
      onCompleted();
    }
  }

  if (initialProgress === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.secondary} />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <WebView
        // Without a baseUrl the page's origin is null/about:blank, which the
        // YouTube IFrame API rejects with "Error 153" (video player
        // configuration error) as soon as playback is attempted — setting
        // this to youtube.com's own origin is the standard fix.
        source={{ html: buildPlayerHtml(initialProgress), baseUrl: "https://www.youtube.com" }}
        onMessage={handleMessage}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    overflow: "hidden",
  },
  webview: {
    height: 220,
  },
  loading: {
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
});
