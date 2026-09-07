import { act, fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { RefreshControl } from "react-native";
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

  it("shows the checklist with all 5 task types", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => {
      expect(screen.getByText("Assinar o contrato")).toBeTruthy();
    });
    expect(screen.getByText("Enviar documentos")).toBeTruthy();
    expect(screen.getByText("Assistir ao vídeo de boas-vindas")).toBeTruthy();
    expect(screen.getByText("Conhecer o time")).toBeTruthy();
    expect(screen.getByText("Configurar seus acessos")).toBeTruthy();
    expect(screen.getByText("0 de 5 concluídos")).toBeTruthy();
  });

  it("expanding the video task renders the WelcomeVideoPlayer and completes the task when it ends", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Assistir ao vídeo de boas-vindas")).toBeTruthy());

    fireEvent.press(screen.getByText("Assistir ao vídeo de boas-vindas"));
    const webview = await screen.findByTestId("welcome-video-webview");
    fireEvent(webview, "message", { nativeEvent: { data: JSON.stringify({ type: "ended" }) } });

    await waitFor(() => {
      expect(screen.getByText("1 de 5 concluídos")).toBeTruthy();
    });
  });

  it("expanding the team task shows TeamSection and completes it on manual toggle", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Conhecer o time")).toBeTruthy());

    fireEvent.press(screen.getByText("Conhecer o time"));
    fireEvent.press(screen.getByText("Marcar como concluído"));

    await waitFor(() => {
      expect(screen.getByText("1 de 5 concluídos")).toBeTruthy();
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
      expect(screen.getByText("1 de 5 concluídos")).toBeTruthy();
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

  it("shows the completion dialog once every task is done and no access has been granted yet", async () => {
    completedTaskIds = ["t1", "t2", "t3", "t4"];
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
});
