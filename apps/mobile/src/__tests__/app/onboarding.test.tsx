import { act, fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Alert, RefreshControl } from "react-native";
import { saveSessionToken } from "@/lib/session";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));

jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: jest.fn().mockResolvedValue("ZmFrZS1pbWFnZS1kYXRh"),
  EncodingType: { Base64: "base64", UTF8: "utf8" },
}));

jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return { WebView: (props: Record<string, unknown>) => <View testID="welcome-video-webview" {...props} /> };
});

const BASE_TASKS = [
  { id: "t1", icon: "document-text-outline", title: "Assinar o contrato", description: "Revise.", order: 1, requiresUpload: false, requiresVideo: false, showsTeam: false, requiresContract: true, requiresAccessChecklist: false },
  { id: "t2", icon: "cloud-upload-outline", title: "Enviar documentos", description: "RG, CPF...", order: 2, requiresUpload: true, requiresVideo: false, showsTeam: false, requiresContract: false, requiresAccessChecklist: false },
  { id: "t3", icon: "play-circle-outline", title: "Assistir ao vídeo de boas-vindas", description: "Conheça a empresa.", order: 3, requiresUpload: false, requiresVideo: true, showsTeam: false, requiresContract: false, requiresAccessChecklist: false },
  { id: "t4", icon: "people-outline", title: "Conhecer o time", description: "Veja quem trabalha aqui.", order: 4, requiresUpload: false, requiresVideo: false, showsTeam: true, requiresContract: false, requiresAccessChecklist: false },
  { id: "t5", icon: "key-outline", title: "Configurar seus acessos", description: "Peça os acessos de TI.", order: 5, requiresUpload: false, requiresVideo: false, showsTeam: false, requiresContract: false, requiresAccessChecklist: true },
  { id: "t6", icon: "checkmark-circle-outline", title: "Ler o código de conduta", description: "Leia e concorde com as regras.", order: 6, requiresUpload: false, requiresVideo: false, showsTeam: false, requiresContract: false, requiresAccessChecklist: false },
];

let completedTaskIds: string[];
let completedAccessItems: string[];
let fullAccessGrantedAt: string | null;

describe("onboarding screen", () => {
  beforeEach(async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake-rg.jpg" }],
    });
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null });

    completedTaskIds = [];
    completedAccessItems = [];
    fullAccessGrantedAt = null;

    (globalThis.fetch as jest.Mock) = jest.fn((url: string, options?: RequestInit) => {
      if (url.endsWith("/onboarding/tarefas")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ tasks: BASE_TASKS, completedTaskIds, completedAccessItems, fullAccessGrantedAt }),
        });
      }
      if (url.includes("/onboarding/tarefas/") && url.endsWith("/toggle")) {
        const taskId = url.split("/onboarding/tarefas/")[1].replace("/toggle", "");
        const already = completedTaskIds.includes(taskId);
        completedTaskIds = already ? completedTaskIds.filter((id) => id !== taskId) : [...completedTaskIds, taskId];
        return Promise.resolve({ ok: true, json: async () => ({ completed: !already }) });
      }
      if (url.includes("/onboarding/acessos/") && url.endsWith("/toggle")) {
        const item = url.split("/onboarding/acessos/")[1].replace("/toggle", "");
        const already = completedAccessItems.includes(item);
        completedAccessItems = already
          ? completedAccessItems.filter((i) => i !== item)
          : [...completedAccessItems, item];
        // Mirrors OnboardingService.mergeDerivedCompletion: "Configurar seus
        // acessos" (t5) is never toggled directly, it completes on its own
        // once every fixed access item is present.
        if (completedAccessItems.length === 5 && !completedTaskIds.includes("t5")) {
          completedTaskIds = [...completedTaskIds, "t5"];
        } else if (completedAccessItems.length < 5) {
          completedTaskIds = completedTaskIds.filter((id) => id !== "t5");
        }
        return Promise.resolve({ ok: true, json: async () => ({ completed: !already }) });
      }
      if (url.endsWith("/documentos/admissionais") && options?.method === "POST") {
        const body = JSON.parse(options.body as string) as { kind: string };
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "adm-new",
            kind: body.kind,
            title: body.kind.toUpperCase(),
            status: "enviado",
            reviewNote: null,
            submittedAt: new Date().toISOString(),
          }),
        });
      }
      if (url.endsWith("/documentos/admissionais")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.endsWith("/documentos/contrato")) {
        return Promise.resolve({ ok: true, json: async () => ({ submittedAt: null }) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    await saveSessionToken("test-token");
  });

  it("shows the checklist with all 6 task types", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => {
      expect(screen.getByText("Assinar o contrato")).toBeTruthy();
    });
    expect(screen.getByText("Enviar documentos")).toBeTruthy();
    expect(screen.getByText("Assistir ao vídeo de boas-vindas")).toBeTruthy();
    expect(screen.getByText("Conhecer o time")).toBeTruthy();
    expect(screen.getByText("Configurar seus acessos")).toBeTruthy();
    expect(screen.getByText("Ler o código de conduta")).toBeTruthy();
    expect(screen.getByText("0 de 6 concluídos")).toBeTruthy();
  });

  it("toggles a plain (non-expandable) task directly, without needing to expand it", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Ler o código de conduta")).toBeTruthy());

    fireEvent.press(screen.getByText("Ler o código de conduta"));

    await waitFor(() => {
      expect(screen.getByText("1 de 6 concluídos")).toBeTruthy();
    });
  });

  it("expanding the video task renders the WelcomeVideoPlayer and completes the task when it ends", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Assistir ao vídeo de boas-vindas")).toBeTruthy());

    fireEvent.press(screen.getByText("Assistir ao vídeo de boas-vindas"));
    const webview = await screen.findByTestId("welcome-video-webview");
    fireEvent(webview, "message", { nativeEvent: { data: JSON.stringify({ type: "ended" }) } });

    await waitFor(() => {
      expect(screen.getByText("1 de 6 concluídos")).toBeTruthy();
    });
  });

  it("expanding the team task shows TeamSection and completes it on manual toggle", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Conhecer o time")).toBeTruthy());

    fireEvent.press(screen.getByText("Conhecer o time"));
    fireEvent.press(screen.getByText("Marcar como concluído"));

    await waitFor(() => {
      expect(screen.getByText("1 de 6 concluídos")).toBeTruthy();
    });
  });

  it("expanding the contract task shows ContractBox and completes the task on submit", async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake.pdf", name: "contrato.pdf", mimeType: "application/pdf" }],
    });
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Assinar o contrato")).toBeTruthy());

    fireEvent.press(screen.getByText("Assinar o contrato"));
    fireEvent.press(screen.getByText("Enviar PDF assinado"));

    await waitFor(() => {
      expect(screen.getByText("1 de 6 concluídos")).toBeTruthy();
    });
  });

  it("expanding the access checklist task shows AccessChecklistSection and toggles items independently", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Configurar seus acessos")).toBeTruthy());

    fireEvent.press(screen.getByText("Configurar seus acessos"));
    fireEvent.press(screen.getByText("SGN Portal"));

    await waitFor(() => {
      expect(screen.getAllByText("Concluído")).toHaveLength(1);
    });
  });

  it("alerts when toggling an access item fails", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const baseFetch = globalThis.fetch as jest.Mock;
    (globalThis.fetch as jest.Mock) = jest.fn((url: string, options?: RequestInit) => {
      if (url.includes("/onboarding/acessos/") && url.endsWith("/toggle")) {
        return Promise.resolve({ ok: false });
      }
      return baseFetch(url, options);
    });

    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Configurar seus acessos")).toBeTruthy());

    fireEvent.press(screen.getByText("Configurar seus acessos"));
    fireEvent.press(screen.getByText("SGN Portal"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Não foi possível atualizar",
        expect.stringContaining("Tente novamente"),
      );
    });
    alertSpy.mockRestore();
  });

  it("shows the completion dialog once every task is done and no access has been granted yet", async () => {
    completedTaskIds = ["t1", "t2", "t3", "t4", "t6"];
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Configurar seus acessos")).toBeTruthy());

    fireEvent.press(screen.getByText("Configurar seus acessos"));
    fireEvent.press(screen.getByText("SGN Portal"));
    fireEvent.press(screen.getByText("Movidesk"));
    fireEvent.press(screen.getByText("Email corporativo"));
    fireEvent.press(screen.getByText("Teams"));
    fireEvent.press(screen.getByText("Site24x7"));

    await waitFor(() => {
      expect(screen.getByText("🎉 Parabéns! Onboarding concluído")).toBeTruthy();
    });
  });

  it("shows the unlocked dialog when fullAccessGrantedAt transitions from null to a value on refetch", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Assinar o contrato")).toBeTruthy());

    fullAccessGrantedAt = "2026-09-07T12:00:00.000Z";
    // Pull-to-refresh re-runs load() the same way returning to this screen
    // (useFocusEffect) would in the real app. @react-native/jest-preset mocks
    // RefreshControl's render() to drop every prop (including testID and
    // onRefresh), so it can't be queried/fired via fireEvent — instead reach
    // the real onRefresh through the mock's documented escape hatch: React
    // still sets the mounted instance's actual `.props`, and the mock class
    // exposes the last-mounted instance as a static `latestRef`.
    await act(async () => {
      await (
        RefreshControl as unknown as { latestRef: { props: { onRefresh: () => void } } }
      ).latestRef.props.onRefresh();
    });

    await waitFor(() => {
      expect(screen.getByText("🎉 Acesso liberado!")).toBeTruthy();
    });
  });

  it("does not show the completion dialog on initial mount, even when every task is already complete", async () => {
    // Colaborador already finished the track in a previous session: the
    // very first /onboarding/tarefas response already reports every task
    // done, with no grant yet. The transition-detector refs must be seeded
    // from this first load, not compared against it — otherwise this looks
    // like a false -> true transition on every mount.
    completedTaskIds = ["t1", "t2", "t3", "t4", "t5", "t6"];
    completedAccessItems = ["sgn", "movidesk", "email", "teams", "site24x7"];
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => {
      expect(screen.getByText("6 de 6 concluídos")).toBeTruthy();
    });
    expect(screen.queryByText("🎉 Parabéns! Onboarding concluído")).toBeNull();
  });

  it("does not show the unlocked dialog on initial mount when access was already granted previously", async () => {
    // Colaborador was already granted full access in a previous session:
    // fullAccessGrantedAt is non-null from the very first fetch. Same
    // seed-not-compare requirement as above, this time for the grant date.
    fullAccessGrantedAt = "2026-08-01T09:00:00.000Z";
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => expect(screen.getByText("Assinar o contrato")).toBeTruthy());
    expect(screen.queryByText("🎉 Acesso liberado!")).toBeNull();
  });

  it("expanding the upload task shows the 5 fixed document boxes", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Enviar documentos")).toBeTruthy());

    fireEvent.press(screen.getByText("Enviar documentos"));

    expect(screen.getByText("RG")).toBeTruthy();
    expect(screen.getByText("CPF")).toBeTruthy();
    expect(screen.getByText("Comprovante de endereço")).toBeTruthy();
    expect(screen.getByText("Certidão de casamento")).toBeTruthy();
    expect(screen.getByText("Certidão de nascimento dos filhos")).toBeTruthy();
  });

  it("submitting a document from the onboarding upload task posts to /documentos/admissionais", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Enviar documentos")).toBeTruthy());

    fireEvent.press(screen.getByText("Enviar documentos"));

    const rgBox = within(screen.getByTestId("admission-box-rg"));
    fireEvent.press(rgBox.getByText("Enviar"));
    fireEvent.press(rgBox.getAllByText("Tirar foto")[0]);
    await waitFor(() => {
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
    });
    fireEvent.press(rgBox.getByText("Enviar"));

    await waitFor(() => {
      const submitCall = (globalThis.fetch as jest.Mock).mock.calls.find(
        ([url, options]: [string, RequestInit | undefined]) =>
          url.endsWith("/documentos/admissionais") && options?.method === "POST",
      );
      expect(submitCall).toBeTruthy();
      const body = JSON.parse(submitCall![1].body as string) as Record<string, unknown>;
      expect(body).toEqual({ kind: "rg", photos: ["data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh"] });
    });
  });

  it("after submitting a document, the progress count updates optimistically", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Enviar documentos")).toBeTruthy());
    expect(screen.getByText("0 de 6 concluídos")).toBeTruthy();

    fireEvent.press(screen.getByText("Enviar documentos"));

    const rgBox = within(screen.getByTestId("admission-box-rg"));
    fireEvent.press(rgBox.getByText("Enviar"));
    fireEvent.press(rgBox.getAllByText("Tirar foto")[0]);
    await waitFor(() => {
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
    });
    fireEvent.press(rgBox.getByText("Enviar"));

    // onboarding.tsx's onSubmitted callback in the requiresUpload branch
    // calls setDone(...) optimistically as soon as the upload succeeds —
    // this proves that state update actually reaches visible UI (the
    // progress-count text), not just internal state nothing reads.
    await waitFor(() => {
      expect(screen.getByText("1 de 6 concluídos")).toBeTruthy();
    });
  });

  it("shows the team progress list instead of tasks for a gestor", async () => {
    (globalThis.fetch as jest.Mock) = jest.fn((url: string) => {
      if (url.endsWith("/onboarding/equipe")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              userId: "colaborador-1",
              userName: "Ana Colaboradora",
              completedCount: 2,
              totalCount: 5,
              tasks: BASE_TASKS,
              completedTaskIds: ["t1", "t2"],
              fullAccessGrantedAt: null,
              fullAccessGrantSource: null,
              fullAccessGrantedByName: null,
            },
          ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    function b64(value: string) {
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
    await saveSessionToken(`${b64("{}")}.${b64(JSON.stringify({ sub: "gestor-1", role: "gestor", name: "Bruno" }))}.sig`);

    renderRouter("src/app", { initialUrl: "/onboarding" });

    expect(await screen.findByText("Ana Colaboradora")).toBeTruthy();
    expect(screen.getByText("2 de 5 tarefas concluídas")).toBeTruthy();
  });
});
