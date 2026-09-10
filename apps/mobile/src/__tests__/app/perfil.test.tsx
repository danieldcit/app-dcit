import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as ImagePicker from "expo-image-picker";
import { getSessionToken, saveSessionToken } from "@/lib/session";
import { unregisterPushNotifications } from "@/lib/push";

jest.mock("@/lib/push", () => ({
  registerForPushNotifications: jest.fn().mockResolvedValue(undefined),
  unregisterPushNotifications: jest.fn().mockResolvedValue(undefined),
  configureNotificationHandler: jest.fn(),
  addNotificationTapListener: jest.fn().mockReturnValue(() => {}),
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: jest.fn().mockResolvedValue("ZmFrZS1pbWFnZS1kYXRh"),
  EncodingType: { Base64: "base64", UTF8: "utf8" },
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

describe("perfil screen avatar", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shows a previously saved avatar photo inside the edit-photo modal", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/employees/me/avatar")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ photo: "data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Editar foto")).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText("Editar foto"));

    await waitFor(() => {
      expect(screen.getByText("Remover foto")).toBeTruthy();
    });
  });

  it("takes a photo with the camera and uploads it as the new avatar", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake-photo.jpg" }],
    });
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/employees/me/avatar")) {
        return Promise.resolve({ ok: true, json: async () => ({ photo: null }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    globalThis.fetch = fetchMock;

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });
    fireEvent.press(screen.getByLabelText("Editar foto"));

    fireEvent.press(screen.getByText("Tirar foto"));

    await waitFor(() => {
      expect(screen.getByText("Remover foto")).toBeTruthy();
    });
    const uploadCall = fetchMock.mock.calls.find(
      ([url, init]: [string, RequestInit]) =>
        url.includes("/employees/me/avatar") && init?.method === "POST",
    );
    expect(uploadCall).toBeTruthy();
    expect(JSON.parse(uploadCall![1].body as string).photo).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("removes the saved avatar photo", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));
    const fetchMock = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/employees/me/avatar")) {
        if (init?.method === "DELETE") {
          return Promise.resolve({ ok: true, json: async () => ({}) });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ photo: "data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    globalThis.fetch = fetchMock;

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Editar foto")).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText("Editar foto"));
    await waitFor(() => {
      expect(screen.getByText("Remover foto")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Remover foto"));

    await waitFor(() => {
      expect(screen.queryByText("Remover foto")).toBeNull();
    });
    const deleteCall = fetchMock.mock.calls.find(
      ([url, init]: [string, RequestInit]) =>
        url.includes("/employees/me/avatar") && init?.method === "DELETE",
    );
    expect(deleteCall).toBeTruthy();
  });
});

describe("perfil screen change password", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function openPasswordModal() {
    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });
    fireEvent.press(screen.getByText("Alterar senha"));
  }

  it("changes the password successfully", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/auth/change-password")) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    globalThis.fetch = fetchMock;

    await openPasswordModal();
    fireEvent.changeText(screen.getByPlaceholderText("Senha atual"), "senha-antiga");
    fireEvent.changeText(screen.getByPlaceholderText("Nova senha"), "senha-nova-123");
    fireEvent.changeText(screen.getByPlaceholderText("Confirmar nova senha"), "senha-nova-123");
    fireEvent.press(screen.getByText("Salvar nova senha"));

    await waitFor(() => {
      expect(screen.getByText("Senha alterada com sucesso.")).toBeTruthy();
    });
    const call = fetchMock.mock.calls.find(([url]: [string]) => url.includes("/auth/change-password"));
    expect(call).toBeTruthy();
    expect(JSON.parse(call![1].body as string)).toEqual({
      currentPassword: "senha-antiga",
      newPassword: "senha-nova-123",
    });
  });

  it("shows an inline error when the new passwords don't match, without calling the API", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    globalThis.fetch = fetchMock;

    await openPasswordModal();
    fireEvent.changeText(screen.getByPlaceholderText("Senha atual"), "senha-antiga");
    fireEvent.changeText(screen.getByPlaceholderText("Nova senha"), "senha-nova-123");
    fireEvent.changeText(screen.getByPlaceholderText("Confirmar nova senha"), "outra-coisa");
    fireEvent.press(screen.getByText("Salvar nova senha"));

    await waitFor(() => {
      expect(screen.getByText("As senhas não coincidem.")).toBeTruthy();
    });
    expect(fetchMock.mock.calls.find(([url]: [string]) => url.includes("/auth/change-password"))).toBeFalsy();
  });

  it("shows the server's error message when the current password is wrong", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/auth/change-password")) {
        return Promise.resolve({
          ok: false,
          json: async () => ({ message: "Senha atual incorreta." }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    await openPasswordModal();
    fireEvent.changeText(screen.getByPlaceholderText("Senha atual"), "senha-errada");
    fireEvent.changeText(screen.getByPlaceholderText("Nova senha"), "senha-nova-123");
    fireEvent.changeText(screen.getByPlaceholderText("Confirmar nova senha"), "senha-nova-123");
    fireEvent.press(screen.getByText("Salvar nova senha"));

    await waitFor(() => {
      expect(screen.getByText("Senha atual incorreta.")).toBeTruthy();
    });
  });
});

describe("perfil screen Meu Perfil", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function openPersonalDataModal() {
    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });
    fireEvent.press(screen.getByText("Meu Perfil"));
  }

  const EMPTY_PERSONAL_DATA = {
    rg: null,
    dataNascimento: null,
    estadoCivil: null,
    enderecoRua: null,
    enderecoNumero: null,
    enderecoBairro: null,
    enderecoCidade: null,
    enderecoEstado: null,
    enderecoCep: null,
    phone: null,
  };

  it("saves personal data successfully", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));
    const fetchMock = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/employees/me/personal-data")) {
        if (init?.method === "PATCH") {
          return Promise.resolve({ ok: true, json: async () => ({ ...EMPTY_PERSONAL_DATA }) });
        }
        return Promise.resolve({ ok: true, json: async () => EMPTY_PERSONAL_DATA });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    globalThis.fetch = fetchMock;

    await openPersonalDataModal();
    fireEvent.changeText(screen.getByLabelText("RG"), "111222333");
    fireEvent.changeText(screen.getByLabelText("Telefone"), "11987654321");
    fireEvent.press(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(screen.getByText("Dados salvos com sucesso.")).toBeTruthy();
    });
    const call = fetchMock.mock.calls.find(
      ([url, init]: [string, RequestInit]) =>
        url.includes("/employees/me/personal-data") && init?.method === "PATCH",
    );
    expect(call).toBeTruthy();
    const body = JSON.parse(call![1].body as string);
    expect(body.rg).toBe("111222333");
    expect(body.phone).toBe("11987654321");
  });

  it("prefills the form with previously saved data", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/employees/me/personal-data")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ...EMPTY_PERSONAL_DATA,
            rg: "999888777",
            dataNascimento: "1990-05-20",
            phone: "11987654321",
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    await openPersonalDataModal();

    await waitFor(() => {
      expect(screen.getByLabelText("RG").props.value).toBe("999888777");
    });
    expect(screen.getByLabelText("Data de nascimento").props.value).toBe("20/05/1990");
    expect(screen.getByLabelText("Telefone").props.value).toBe("11987654321");
  });

  it("rejects an invalid dataNascimento before calling the API", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => EMPTY_PERSONAL_DATA });
    globalThis.fetch = fetchMock;

    await openPersonalDataModal();
    fireEvent.changeText(screen.getByLabelText("Data de nascimento"), "31-13-2000");
    fireEvent.press(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(
        screen.getByText("Data de nascimento inválida. Use o formato DD/MM/AAAA."),
      ).toBeTruthy();
    });
    expect(
      fetchMock.mock.calls.find(
        ([url, init]: [string, RequestInit]) =>
          url.includes("/employees/me/personal-data") && init?.method === "PATCH",
      ),
    ).toBeFalsy();
  });

  it("selects an estado civil from the picker", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => EMPTY_PERSONAL_DATA });

    await openPersonalDataModal();
    fireEvent.press(screen.getByLabelText("Estado civil"));
    fireEvent.press(screen.getByText("Casado(a)"));

    await waitFor(() => {
      expect(screen.getByText("Casado(a)")).toBeTruthy();
    });
  });
});
