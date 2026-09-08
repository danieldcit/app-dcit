import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

// The locked-colaborador redirect test below navigates to the real
// /onboarding screen, which lazily requires WelcomeVideoPlayer ->
// react-native-webview. That native module isn't registered under Jest
// (same gap onboarding.test.tsx works around), so without this mock the
// route crashes while mounting and the redirect assertion never resolves.
jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return { WebView: (props: Record<string, unknown>) => <View testID="welcome-video-webview" {...props} /> };
});

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function fakeJwt(claims: Record<string, unknown>) {
  function encode(value: string) {
    const bytes = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
    let bits = "";
    for (let i = 0; i < bytes.length; i++) bits += bytes.charCodeAt(i).toString(2).padStart(8, "0");
    let out = "";
    for (let i = 0; i + 6 <= bits.length; i += 6) out += BASE64URL[parseInt(bits.slice(i, i + 6), 2)];
    const rem = bits.length % 6;
    if (rem) out += BASE64URL[parseInt(bits.slice(-rem).padEnd(6, "0"), 2)];
    return out;
  }
  return `${encode("{}")}.${encode(JSON.stringify(claims))}.signature`;
}

describe("(tabs) navigation", () => {
  it("renders a tab bar with all 5 sections", () => {
    renderRouter("src/app", { initialUrl: "/" });

    expect(screen.getByText("Ponto")).toBeTruthy();
    expect(screen.getByText("Banco de Horas")).toBeTruthy();
    expect(screen.getByText("Férias")).toBeTruthy();
    expect(screen.getByText("Documentos")).toBeTruthy();
    expect(screen.getByText("Mural")).toBeTruthy();

    expect(screen.getAllByLabelText(/, tab, \d+ of \d+$/)).toHaveLength(5);
  });

  it("navigates to the Banco de Horas route", () => {
    renderRouter("src/app", { initialUrl: "/banco-de-horas" });

    expect(screen).toHavePathname("/banco-de-horas");
  });

  it("redirects a locked colaborador to /onboarding", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ unlocked: false }) });
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(screen).toHavePathname("/onboarding");
    });
  });

  it("does not redirect an unlocked colaborador", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ unlocked: true }) });
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(screen.getByText("Ponto")).toBeTruthy();
    });
    expect(screen).toHavePathname("/");
  });

  it("never redirects a gestor even if the status endpoint says locked", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ unlocked: false }) });
    await saveSessionToken(fakeJwt({ sub: "gestor-1", role: "gestor", name: "Bruno" }));

    renderRouter("src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(screen.getByText("Ponto")).toBeTruthy();
    });
    expect(screen).toHavePathname("/");
  });

  it("fails open (no redirect) when the status request errors", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("network"));
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(screen.getByText("Ponto")).toBeTruthy();
    });
    expect(screen).toHavePathname("/");
  });

  it("expands to reveal Onboarding and Notificações shortcuts, then navigates and collapses", async () => {
    renderRouter("src/app", { initialUrl: "/" });

    expect(screen.queryByText("Onboarding")).toBeNull();
    fireEvent.press(screen.getByLabelText("Mais opções"));

    expect(await screen.findByText("Onboarding")).toBeTruthy();
    expect(screen.getByText("Notificações")).toBeTruthy();

    fireEvent.press(screen.getByText("Onboarding"));

    await waitFor(() => {
      expect(screen).toHavePathname("/onboarding");
    });
  });
});
