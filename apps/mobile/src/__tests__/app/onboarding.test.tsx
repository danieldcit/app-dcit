import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import * as ImagePicker from "expo-image-picker";
import { saveSessionToken } from "@/lib/session";

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

globalThis.fetch = jest.fn();

describe("onboarding screen", () => {
  beforeEach(async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake-rg.jpg" }],
    });

    (globalThis.fetch as jest.Mock).mockReset();
    (globalThis.fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith("/onboarding/tarefas")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tasks: [
              { id: "t1", icon: "document-text-outline", title: "Assinar o contrato", description: "Revise.", order: 1, requiresUpload: false },
              { id: "t2", icon: "cloud-upload-outline", title: "Enviar documentos", description: "RG, CPF...", order: 2, requiresUpload: true },
            ],
            completedTaskIds: [],
          }),
        });
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
      if (url.includes("/toggle")) {
        return Promise.resolve({ ok: true, json: async () => ({ completed: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    await saveSessionToken("test-token");
  });

  it("shows the checklist with the upload task alongside plain toggle tasks", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => {
      expect(screen.getByText("Assinar o contrato")).toBeTruthy();
    });
    expect(screen.getByText("Enviar documentos")).toBeTruthy();
    expect(screen.getByText("0 de 2 concluídos")).toBeTruthy();
  });

  it("toggles a plain (non-upload) step as completed and updates the progress count", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => {
      expect(screen.getByText("Assinar o contrato")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Assinar o contrato"));

    await waitFor(() => {
      expect(screen.getByText("1 de 2 concluídos")).toBeTruthy();
    });
  });

  it("expanding the upload task shows the 5 fixed document boxes instead of toggling", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => {
      expect(screen.getByText("Enviar documentos")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Enviar documentos"));

    expect(screen.getByText("RG")).toBeTruthy();
    expect(screen.getByText("CPF")).toBeTruthy();
    expect(screen.getByText("Comprovante de endereço")).toBeTruthy();
    expect(screen.getByText("Certidão de casamento")).toBeTruthy();
    expect(screen.getByText("Certidão de nascimento dos filhos")).toBeTruthy();
  });

  it("submitting a document from the onboarding task posts to /documentos/admissionais", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => {
      expect(screen.getByText("Enviar documentos")).toBeTruthy();
    });
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
});
