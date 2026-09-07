import { Alert } from "react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

type StoredProgress = {
  userId: string;
  userName: string;
  completedCount: number;
  totalCount: number;
  tasks: Record<string, unknown>[];
  completedTaskIds: string[];
  fullAccessGrantedAt: string | null;
  fullAccessGrantSource: string | null;
  fullAccessGrantedByName: string | null;
};

describe("onboarding detalhe screen", () => {
  let teamProgress: StoredProgress[];

  beforeEach(async () => {
    teamProgress = [
      {
        userId: "colaborador-1",
        userName: "Ana Colaboradora",
        completedCount: 1,
        totalCount: 1,
        tasks: [
          { id: "t1", icon: "document-text-outline", title: "Assinar o contrato", description: "Revise.", order: 1, requiresUpload: false, requiresVideo: false, showsTeam: false, requiresContract: true, requiresAccessChecklist: false },
        ],
        completedTaskIds: ["t1"],
        fullAccessGrantedAt: null,
        fullAccessGrantSource: null,
        fullAccessGrantedByName: null,
      },
    ];

    (globalThis.fetch as jest.Mock) = jest.fn((url: string, options?: RequestInit) => {
      if (url.endsWith("/onboarding/equipe") && !options?.method) {
        return Promise.resolve({ ok: true, json: async () => teamProgress });
      }
      if (url.includes("/liberar-acesso")) {
        teamProgress[0].fullAccessGrantedAt = "2026-09-07T12:00:00.000Z";
        teamProgress[0].fullAccessGrantSource = "manual";
        teamProgress[0].fullAccessGrantedByName = "Bruno Gestor";
        return Promise.resolve({
          ok: true,
          json: async () => ({ grantedAt: "2026-09-07T12:00:00.000Z", source: "manual", grantedByName: "Bruno Gestor" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => teamProgress });
    });
    await saveSessionToken("test-token");
  });

  it("shows the selected colaborador's tasks with their status", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding-detalhe?userId=colaborador-1" });

    expect(await screen.findByText("Ana Colaboradora")).toBeTruthy();
    expect(screen.getByText("Assinar o contrato")).toBeTruthy();
    expect(screen.getByText("Concluída")).toBeTruthy();
  });

  it("grants full access after confirmation", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_title, _msg, buttons) => {
      const confirm = buttons?.find((b) => b.text === "Confirmar liberação");
      confirm?.onPress?.();
    });

    renderRouter("src/app", { initialUrl: "/onboarding-detalhe?userId=colaborador-1" });
    await screen.findByText("Ana Colaboradora");

    fireEvent.press(screen.getByText("Liberar acesso total ao SGP Portal"));

    await waitFor(() => {
      expect(
        (globalThis.fetch as jest.Mock).mock.calls.some(([url]: [string]) =>
          url.endsWith("/onboarding/equipe/colaborador-1/liberar-acesso"),
        ),
      ).toBe(true);
    });
    alertSpy.mockRestore();
  });
});
