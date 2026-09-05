import { EmployeeCreateSchema } from "./employee-create";

const VALID_PAYLOAD = {
  name: "Ana Colaboradora",
  role: "colaborador" as const,
  email: "ana.colaboradora@dev.local",
  cargo: "desenvolvedor" as const,
  team: "SGN360",
  nivel: "pleno" as const,
  convencaoId: "convencao-1" as const,
  salarioMensal: 5000,
  hireDate: "2026-01-15",
  cpf: "12345678901",
  rg: "1234567",
  dataNascimento: "1990-05-20",
  estadoCivil: "casado" as const,
  enderecoRua: "Rua das Flores",
  enderecoNumero: "100",
  enderecoBairro: "Centro",
  enderecoCidade: "São Paulo",
  enderecoEstado: "SP" as const,
  enderecoCep: "01310100",
};

describe("EmployeeCreateSchema", () => {
  it("accepts a fully populated valid payload", () => {
    const result = EmployeeCreateSchema.safeParse(VALID_PAYLOAD);
    expect(result.success).toBe(true);
  });

  it("accepts every personal field as null", () => {
    const result = EmployeeCreateSchema.safeParse({
      name: "Ana Colaboradora",
      role: "colaborador",
      email: null,
      cargo: null,
      team: null,
      nivel: null,
      convencaoId: null,
      salarioMensal: null,
      hireDate: "2026-01-15",
      cpf: null,
      rg: null,
      dataNascimento: null,
      estadoCivil: null,
      enderecoRua: null,
      enderecoNumero: null,
      enderecoBairro: null,
      enderecoCidade: null,
      enderecoEstado: null,
      enderecoCep: null,
    });
    expect(result.success).toBe(true);
  });

  it("coerces salarioMensal from a string (form submission)", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, salarioMensal: "5000.50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.salarioMensal).toBe(5000.5);
    }
  });

  it("rejects a negative salarioMensal", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, salarioMensal: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects a CPF with punctuation", () => {
    const result = EmployeeCreateSchema.safeParse({
      ...VALID_PAYLOAD,
      cpf: "123.456.789-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a CPF shorter than 11 digits", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, cpf: "123456789" });
    expect(result.success).toBe(false);
  });

  it("rejects a CEP with a hyphen", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, enderecoCep: "01310-100" });
    expect(result.success).toBe(false);
  });

  it("rejects an estadoCivil outside the fixed list", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, estadoCivil: "namorando" });
    expect(result.success).toBe(false);
  });

  it("rejects an enderecoEstado that isn't a real UF", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, enderecoEstado: "ZZ" });
    expect(result.success).toBe(false);
  });

  it("rejects a cargo outside the fixed list", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, cargo: "estagiario" });
    expect(result.success).toBe(false);
  });

  it("rejects a nivel outside junior/pleno/senior/especialista", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, nivel: "trainee" });
    expect(result.success).toBe(false);
  });

  it("rejects a role outside colaborador/gestor/rh", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, role: "admin" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("accepts a null email (no password-login for this employee)", () => {
    const result = EmployeeCreateSchema.safeParse({ ...VALID_PAYLOAD, email: null });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const { name: _name, ...rest } = VALID_PAYLOAD;
    const result = EmployeeCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a full ISO datetime instead of a plain date for hireDate", () => {
    const result = EmployeeCreateSchema.safeParse({
      ...VALID_PAYLOAD,
      hireDate: "2026-01-15T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});
