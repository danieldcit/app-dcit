import { fetchSignedContract, submitSignedContract } from "@/lib/documentos-api";

describe("documentos-api: signed contract", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  it("fetchSignedContract returns the record on success", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ submittedAt: "2026-09-01T00:00:00.000Z" }),
    });
    expect(await fetchSignedContract("token")).toEqual({ submittedAt: "2026-09-01T00:00:00.000Z" });
  });

  it("fetchSignedContract returns null on failure", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
    expect(await fetchSignedContract("token")).toBeNull();
  });

  it("submitSignedContract posts the fileDataUrl to /documentos/contrato", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ submittedAt: "2026-09-07T00:00:00.000Z" }),
    });
    const result = await submitSignedContract("token", "data:application/pdf;base64,AAAA");
    expect(result).toEqual({ submittedAt: "2026-09-07T00:00:00.000Z" });
    const call = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toContain("/documentos/contrato");
    expect(JSON.parse(call[1].body)).toEqual({ fileDataUrl: "data:application/pdf;base64,AAAA" });
  });

  it("submitSignedContract returns null on failure", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
    expect(await submitSignedContract("token", "data:application/pdf;base64,AAAA")).toBeNull();
  });
});
