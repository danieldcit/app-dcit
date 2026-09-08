import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/hooks/use-theme";
import { WEB_APP_URL } from "@/constants/api";

// Same video as the web version (apps/web/.../onboarding/welcome-video-player.tsx).
const VIDEO_ID = "9US-Rv6-354";
const PROGRESS_STORAGE_KEY = `onboarding-video-progress:${VIDEO_ID}`;

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
        // Injecting the player HTML directly into the WebView (as raw
        // {html, baseUrl}) hits YouTube's embed authorization wall no matter
        // which baseUrl is used — youtube.com itself as baseUrl gets
        // rejected as self-referential ("Error 152"), and any other faked
        // origin gets silently degraded to YouTube's non-interactive "Watch
        // on YouTube" fallback card instead of a real player. Navigating to
        // a genuine page hosted by the web app sidesteps all of that: the
        // WebView loads a real URL over a real origin, exactly like the
        // browser-based web app already does successfully, so YouTube's
        // authorization check passes the same way it does there.
        source={{ uri: `${WEB_APP_URL}/onboarding-video?progress=${initialProgress}` }}
        onMessage={handleMessage}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // The YouTube IFrame player's own fullscreen button (bottom-right of
        // its controls) calls the web fullscreen API on its <video> element —
        // without this, Android's WebView has nowhere to present that
        // request and the button does nothing.
        allowsFullscreenVideo
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
