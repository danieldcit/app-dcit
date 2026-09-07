import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { getSessionToken, saveSessionToken } from "@/lib/session";
import { unregisterPushNotifications } from "@/lib/push";

jest.mock("@/lib/push", () => ({
  registerForPushNotifications: jest.fn().mockResolvedValue(undefined),
  unregisterPushNotifications: jest.fn().mockResolvedValue(undefined),
  configureNotificationHandler: jest.fn(),
  addNotificationTapListener: jest.fn().mockReturnValue(() => {}),
}));

jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return { WebView: (props: Record<string, unknown>) => <View testID="welcome-video-webview" {...props} /> };
});

function fakeJwt(claims: Record<string, unknown>) {
  const BASE64URL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function encode(value: string) {
    const bytes = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
    let bits = "";
    for (let i = 0; i < bytes.length; i++) bits += bytes.charCodeAt(i).toString(2).padStart(8, "0");
    let out = "";
    for (let i = 0; i + 6 <= bits.length; i += 6) out += BASE64URL_CHARS[parseInt(bits.slice(i, i + 6), 2)];
    const remainder = bits.length % 6;
    if (remainder) out += BASE64URL_CHARS[parseInt(bits.slice(-remainder).padEnd(6, "0"), 2)];
    return out;
  }
  return `${encode("{}")}.${encode(JSON.stringify(claims))}.signature`;
}

describe("perfil screen", () => {
  it("shows the logged-in user's name and role", async () => {
    await saveSessionToken(fakeJwt({ sub: "rh-1", role: "rh", name: "Carla RH" }));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));

    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });
    await waitFor(() => {
      expect(screen.getAllByText("Carla RH").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("RH")).toBeTruthy();
  });

  it("clears the session and returns to login on logout", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });
    await waitFor(() => {
      expect(screen.getByText("Sair da conta")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Sair da conta"));

    await waitFor(() => {
      expect(screen).toHavePathname("/login");
    });
    expect(await getSessionToken()).toBeNull();
  });

  it("still clears the session and returns to login even if push-token cleanup fails", async () => {
    // Regression test: expo-notifications throws a synchronous error from a
    // module-level side effect on Android in Expo Go (removed in SDK 53) —
    // logout must never get stuck behind that, or any other push-cleanup
    // failure.
    (unregisterPushNotifications as jest.Mock).mockRejectedValueOnce(
      new Error(
        "expo-notifications: Android Push notifications (remote notifications) functionality " +
          "provided by expo-notifications was removed from Expo Go with the release of SDK 53.",
      ),
    );
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });
    await waitFor(() => {
      expect(screen.getByText("Sair da conta")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Sair da conta"));

    await waitFor(() => {
      expect(screen).toHavePathname("/login");
    });
    expect(await getSessionToken()).toBeNull();
  });

  it("clears the notification inbox on logout so a new login doesn't briefly show a stale badge", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    let resolveSecondFetch: (() => void) | undefined;
    (globalThis.fetch as jest.Mock) = jest.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/notifications/mine")) {
        if (!resolveSecondFetch) {
          // First fetch (before logout): resolve immediately with one unread item.
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: "n1",
                type: "pagamento",
                category: "salario",
                message: "Seu salário foi depositado.",
                link: null,
                createdAt: "2026-09-02T21:00:00.000Z",
                readAt: null,
              },
            ],
          });
        }
        // Second fetch (after re-login): stays pending until the test
        // resolves it, so we can observe state in the window between
        // logout's reset() and the next refresh() settling.
        return new Promise((resolve) => {
          resolveSecondFetch = () => resolve({ ok: true, json: async () => [] });
        });
      }
      if (typeof url === "string" && url.includes("/auth/password-login")) {
        return Promise.resolve({ ok: true, json: async () => ({ token: "user-b-token" }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderRouter("src/app", { initialUrl: "/" });
    await waitFor(() => {
      expect(screen.getByText("1")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });
    // Mark that the next /notifications/mine call should stay pending.
    resolveSecondFetch = () => {};

    fireEvent.press(screen.getByText("Sair da conta"));
    await waitFor(() => {
      expect(screen).toHavePathname("/login");
    });

    fireEvent.changeText(screen.getByPlaceholderText("Email"), "outro@dev.local");
    fireEvent.changeText(screen.getByPlaceholderText("Senha"), "dev12345");
    fireEvent.press(screen.getByText("Entrar"));

    await waitFor(() => {
      expect(screen).toHavePathname("/");
    });
    // The old user's unread badge must not still be showing while the new
    // user's notifications fetch is still in flight — proof that logout's
    // reset() actually cleared items rather than leaving it stale until the
    // next refresh() resolves.
    expect(screen.queryByText("1")).toBeNull();
  });

  it("navigates to onboarding, benefícios and operacional from the menu", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });

    fireEvent.press(screen.getByText("Boas-vindas / Onboarding"));
    await waitFor(() => {
      expect(screen).toHavePathname("/onboarding");
    });
    fireEvent.press(screen.getByLabelText("Voltar"));

    fireEvent.press(screen.getByText("Benefícios e clube de vantagens"));
    await waitFor(() => {
      expect(screen).toHavePathname("/beneficios");
    });
    fireEvent.press(screen.getByLabelText("Voltar"));

    fireEvent.press(screen.getByText("Operacional / TI"));
    await waitFor(() => {
      expect(screen).toHavePathname("/operacional");
    });
  });

  it("hides the team-atestados menu row for a colaborador", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });

    expect(screen.queryByText("Atestados da equipe")).toBeNull();
  });

  it("shows and navigates to the team-atestados menu row for a gestor", async () => {
    await saveSessionToken(fakeJwt({ sub: "gestor-1", role: "gestor", name: "Bruno Gestor" }));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });

    fireEvent.press(screen.getByText("Atestados da equipe"));
    await waitFor(() => {
      expect(screen).toHavePathname("/atestados-equipe");
    });
  });
});
