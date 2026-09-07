import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { saveSessionToken } from "@/lib/session";
import { ContractBox } from "@/components/contract-box";

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: jest.fn().mockResolvedValue("ZmFrZS1wZGY="),
  EncodingType: { Base64: "base64" },
}));

globalThis.fetch = jest.fn();

describe("ContractBox", () => {
  beforeEach(async () => {
    (globalThis.fetch as jest.Mock).mockReset();
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ submittedAt: "2026-09-07T00:00:00.000Z" }),
    });
    await saveSessionToken("test-token");
  });

  it("shows 'Nenhum contrato assinado enviado ainda.' when there is no existing contract", () => {
    render(<ContractBox existing={null} />);
    expect(screen.getByText("Nenhum contrato assinado enviado ainda.")).toBeTruthy();
    expect(screen.getByText("Enviar PDF assinado")).toBeTruthy();
  });

  it("shows the submission date when a contract already exists", () => {
    render(<ContractBox existing={{ submittedAt: "2026-09-01T00:00:00.000Z" }} />);
    expect(screen.getByText(/Enviado em/)).toBeTruthy();
    expect(screen.getByText("Reenviar")).toBeTruthy();
  });

  it("opens the model download link in the browser", () => {
    render(<ContractBox existing={null} />);
    fireEvent.press(screen.getByText("Baixar modelo do contrato"));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      expect.stringContaining("/documents/contrato-modelo.pdf"),
    );
  });

  it("picks a PDF and submits it as a base64 data URL", async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake.pdf", name: "contrato.pdf", mimeType: "application/pdf" }],
    });
    const onSubmitted = jest.fn();
    render(<ContractBox existing={null} onSubmitted={onSubmitted} />);

    fireEvent.press(screen.getByText("Enviar PDF assinado"));

    await waitFor(() => {
      const call = (globalThis.fetch as jest.Mock).mock.calls.find(([url]: [string]) =>
        url.endsWith("/documentos/contrato"),
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(call![1].body)).toEqual({
        fileDataUrl: "data:application/pdf;base64,ZmFrZS1wZGY=",
      });
    });
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the document picker is canceled", async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null });
    render(<ContractBox existing={null} />);

    fireEvent.press(screen.getByText("Enviar PDF assinado"));

    await waitFor(() => {
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});
