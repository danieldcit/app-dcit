import { FiscalParametersInputSchema } from "./fiscal-parameters";

const VALID_PAYLOAD = {
  inssPatronalPercent: 20,
  ratPercent: 2,
  fgtsPercent: 8,
  sujeitoDesoneracaoFolha: false,
  fonteLegal: "Lei 8.212/1991, art. 22",
  vigenciaData: "2026-01-01",
};

describe("FiscalParametersInputSchema", () => {
  it("accepts a fully populated valid payload", () => {
    const result = FiscalParametersInputSchema.safeParse(VALID_PAYLOAD);
    expect(result.success).toBe(true);
  });

  it("accepts every field as null (not yet configured)", () => {
    const result = FiscalParametersInputSchema.safeParse({
      inssPatronalPercent: null,
      ratPercent: null,
      fgtsPercent: null,
      sujeitoDesoneracaoFolha: null,
      fonteLegal: null,
      vigenciaData: null,
    });
    expect(result.success).toBe(true);
  });

  it("coerces percentage fields from strings (form submissions)", () => {
    const result = FiscalParametersInputSchema.safeParse({
      ...VALID_PAYLOAD,
      inssPatronalPercent: "20",
      fgtsPercent: "8",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inssPatronalPercent).toBe(20);
      expect(result.data.fgtsPercent).toBe(8);
    }
  });

  it("rejects a ratPercent outside 1-3", () => {
    const result = FiscalParametersInputSchema.safeParse({ ...VALID_PAYLOAD, ratPercent: 4 });
    expect(result.success).toBe(false);
  });

  it("rejects sujeitoDesoneracaoFolha as a string (must be a real boolean, not coerced)", () => {
    const result = FiscalParametersInputSchema.safeParse({ ...VALID_PAYLOAD, sujeitoDesoneracaoFolha: "false" });
    expect(result.success).toBe(false);
  });
});
