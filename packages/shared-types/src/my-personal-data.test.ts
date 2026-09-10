import { MyPersonalDataUpdateSchema } from "./my-personal-data";

const VALID = {
  rg: "123456789",
  dataNascimento: "1990-05-20",
  estadoCivil: "solteiro" as const,
  enderecoRua: "Rua Teste",
  enderecoNumero: "100",
  enderecoBairro: "Centro",
  enderecoCidade: "São Paulo",
  enderecoEstado: "SP" as const,
  enderecoCep: "01310100",
  phone: "11987654321",
};

describe("MyPersonalDataUpdateSchema", () => {
  it("accepts a fully populated payload", () => {
    expect(MyPersonalDataUpdateSchema.safeParse(VALID).success).toBe(true);
  });

  it("accepts all-null fields (clearing personal data)", () => {
    const allNull = Object.fromEntries(Object.keys(VALID).map((key) => [key, null]));
    expect(MyPersonalDataUpdateSchema.safeParse(allNull).success).toBe(true);
  });

  it("rejects a phone that isn't 10 or 11 digits", () => {
    expect(MyPersonalDataUpdateSchema.safeParse({ ...VALID, phone: "123" }).success).toBe(false);
  });

  it("accepts a 10-digit phone (landline)", () => {
    expect(MyPersonalDataUpdateSchema.safeParse({ ...VALID, phone: "1132345678" }).success).toBe(
      true,
    );
  });

  it("rejects a CEP with a hyphen", () => {
    expect(
      MyPersonalDataUpdateSchema.safeParse({ ...VALID, enderecoCep: "01310-100" }).success,
    ).toBe(false);
  });

  it("rejects an estadoCivil outside the fixed list", () => {
    expect(
      MyPersonalDataUpdateSchema.safeParse({ ...VALID, estadoCivil: "namorando" }).success,
    ).toBe(false);
  });

  it("rejects an enderecoEstado outside the fixed UF list", () => {
    expect(MyPersonalDataUpdateSchema.safeParse({ ...VALID, enderecoEstado: "ZZ" }).success).toBe(
      false,
    );
  });

  it("rejects a non-ISO dataNascimento", () => {
    expect(
      MyPersonalDataUpdateSchema.safeParse({ ...VALID, dataNascimento: "20/05/1990" }).success,
    ).toBe(false);
  });

  it("rejects a payload missing a required key", () => {
    const { phone: _phone, ...rest } = VALID;
    expect(MyPersonalDataUpdateSchema.safeParse(rest).success).toBe(false);
  });
});
