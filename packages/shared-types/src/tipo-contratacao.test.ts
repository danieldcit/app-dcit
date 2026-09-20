import { TipoContratacaoUpdateSchema } from "./tipo-contratacao";

describe("TipoContratacaoUpdateSchema", () => {
  it("accepts CLT, PJ, terceirizado and null", () => {
    for (const value of ["CLT", "PJ", "terceirizado", null]) {
      expect(TipoContratacaoUpdateSchema.safeParse({ tipoContratacao: value }).success).toBe(true);
    }
  });

  it("rejects an unknown value", () => {
    const result = TipoContratacaoUpdateSchema.safeParse({ tipoContratacao: "estagiario" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing field", () => {
    const result = TipoContratacaoUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
