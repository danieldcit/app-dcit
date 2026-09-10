import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveSessionToken } from "@/lib/session";

jest.mock("@/lib/push", () => ({
  registerForPushNotifications: jest.fn().mockResolvedValue(undefined),
  unregisterPushNotifications: jest.fn().mockResolvedValue(undefined),
  configureNotificationHandler: jest.fn(),
  addNotificationTapListener: jest.fn().mockReturnValue(() => {}),
}));

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

describe("language switcher", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("switches the Perfil screen to English and translates the tab bar", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });
    await waitFor(() => {
      expect(screen.getByText("Idioma")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("English"));

    await waitFor(() => {
      expect(screen.getByText("My Profile")).toBeTruthy();
    });
    expect(screen.getByText("Change password")).toBeTruthy();
    expect(screen.getByText("Help Center")).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();
  });

  it("switches to Spanish and translates the Central de Ajuda screen", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });
    await waitFor(() => {
      expect(screen.getByText("Idioma")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Español"));

    await waitFor(() => {
      expect(screen.getByText("Centro de Ayuda")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Centro de Ayuda"));

    await waitFor(() => {
      expect(screen).toHavePathname("/ajuda");
    });
    await waitFor(() => {
      expect(screen.getByText("Registro horario")).toBeTruthy();
    });
  });
});
