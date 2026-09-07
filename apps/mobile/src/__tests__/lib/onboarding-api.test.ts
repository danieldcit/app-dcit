import {
  fetchOnboardingStatus,
  toggleOnboardingAccessItem,
  fetchTeamOnboardingProgress,
  grantOnboardingFullAccess,
} from "@/lib/onboarding-api";

describe("onboarding-api", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  describe("fetchOnboardingStatus", () => {
    it("returns the unlocked flag on success", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ unlocked: true }),
      });
      expect(await fetchOnboardingStatus("token")).toEqual({ unlocked: true });
    });

    it("returns null on a non-ok response", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
      expect(await fetchOnboardingStatus("token")).toBeNull();
    });

    it("returns null when fetch throws", async () => {
      (globalThis.fetch as jest.Mock).mockRejectedValue(new Error("network"));
      expect(await fetchOnboardingStatus("token")).toBeNull();
    });
  });

  describe("toggleOnboardingAccessItem", () => {
    it("posts to /onboarding/acessos/:item/toggle and returns the result", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ completed: true }),
      });
      const result = await toggleOnboardingAccessItem("token", "movidesk");
      expect(result).toEqual({ completed: true });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/onboarding/acessos/movidesk/toggle"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("returns null on failure", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
      expect(await toggleOnboardingAccessItem("token", "movidesk")).toBeNull();
    });
  });

  describe("fetchTeamOnboardingProgress", () => {
    it("returns the team progress array on success", async () => {
      const progress = [
        {
          userId: "u1",
          userName: "Ana",
          completedCount: 2,
          totalCount: 5,
          tasks: [],
          completedTaskIds: [],
          fullAccessGrantedAt: null,
          fullAccessGrantSource: null,
          fullAccessGrantedByName: null,
        },
      ];
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => progress });
      expect(await fetchTeamOnboardingProgress("token")).toEqual(progress);
    });

    it("returns null when the response is not an array", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
      expect(await fetchTeamOnboardingProgress("token")).toBeNull();
    });
  });

  describe("grantOnboardingFullAccess", () => {
    it("posts to /onboarding/equipe/:userId/liberar-acesso", async () => {
      const grant = { grantedAt: "2026-09-07T00:00:00.000Z", source: "manual", grantedByName: "Bruno" };
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => grant });
      const result = await grantOnboardingFullAccess("token", "u1");
      expect(result).toEqual(grant);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/onboarding/equipe/u1/liberar-acesso"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("returns null on failure", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
      expect(await grantOnboardingFullAccess("token", "u1")).toBeNull();
    });
  });
});
