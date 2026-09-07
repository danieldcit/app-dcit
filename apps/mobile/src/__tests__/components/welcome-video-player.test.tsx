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

  it("reads any previously saved progress before rendering the WebView", async () => {
    await AsyncStorage.setItem("onboarding-video-progress:9US-Rv6-354", "30");
    render(<WelcomeVideoPlayer onCompleted={jest.fn()} />);

    const webview = await screen.findByTestId("welcome-video-webview");
    expect(webview.props.source.html).toContain("var maxWatched = 30");
  });
});
