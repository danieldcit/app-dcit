import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WelcomeVideoPlayer } from "@/components/welcome-video-player";

jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return { WebView: (props: Record<string, unknown>) => <View testID="welcome-video-webview" {...props} /> };
});

describe("WelcomeVideoPlayer", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("calls onCompleted and clears stored progress when the video ends", async () => {
    await AsyncStorage.setItem("onboarding-video-progress:9US-Rv6-354", "42");
    const onCompleted = jest.fn();
    render(<WelcomeVideoPlayer onCompleted={onCompleted} />);

    const webview = await screen.findByTestId("welcome-video-webview");
    fireEvent(webview, "message", { nativeEvent: { data: JSON.stringify({ type: "ended" }) } });

    expect(onCompleted).toHaveBeenCalledTimes(1);
    await waitFor(async () => {
      expect(await AsyncStorage.getItem("onboarding-video-progress:9US-Rv6-354")).toBeNull();
    });
  });

  it("persists progress messages to AsyncStorage without calling onCompleted", async () => {
    const onCompleted = jest.fn();
    render(<WelcomeVideoPlayer onCompleted={onCompleted} />);

    const webview = await screen.findByTestId("welcome-video-webview");
    act(() => {
      fireEvent(webview, "message", {
        nativeEvent: { data: JSON.stringify({ type: "progress", seconds: 12.5 }) },
      });
    });

    expect(onCompleted).not.toHaveBeenCalled();
    await waitFor(async () => {
      expect(await AsyncStorage.getItem("onboarding-video-progress:9US-Rv6-354")).toBe("12.5");
    });
  });

  it("reads any previously saved progress and passes it to the web app's video embed page", async () => {
    await AsyncStorage.setItem("onboarding-video-progress:9US-Rv6-354", "30");
    render(<WelcomeVideoPlayer onCompleted={jest.fn()} />);

    const webview = await screen.findByTestId("welcome-video-webview");
    expect(webview.props.source.uri).toContain("/onboarding-video?progress=30");
  });

  it("navigates to a real page on the web app instead of injecting HTML, so YouTube's embed authorization sees a genuine origin", async () => {
    render(<WelcomeVideoPlayer onCompleted={jest.fn()} />);

    const webview = await screen.findByTestId("welcome-video-webview");
    expect(webview.props.source.uri).toMatch(/^https?:\/\/.+\/onboarding-video\?progress=0$/);
    expect(webview.props.source.html).toBeUndefined();
  });

  it("allows fullscreen so the player's own fullscreen button works", async () => {
    render(<WelcomeVideoPlayer onCompleted={jest.fn()} />);

    const webview = await screen.findByTestId("welcome-video-webview");
    expect(webview.props.allowsFullscreenVideo).toBe(true);
  });
});
