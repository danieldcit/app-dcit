import { AtestadoInputSchema, AtestadoStatusUpdateSchema } from "./atestado-submission";

const PHOTO_DATA_URL = "data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh";

describe("AtestadoInputSchema", () => {
  it("accepts a fully filled submission", () => {
    const result = AtestadoInputSchema.safeParse({
      cid: "J06.9",
      crm: "CRM-MG 45213",
      medico: "Dr. Carlos Mendes",
      dias: 2,
      photoDataUrl: PHOTO_DATA_URL,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing cid", () => {
    const result = AtestadoInputSchema.safeParse({
      cid: "",
      crm: "CRM-MG 45213",
      medico: "Dr. Carlos Mendes",
      dias: 2,
      photoDataUrl: PHOTO_DATA_URL,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive dias", () => {
    const result = AtestadoInputSchema.safeParse({
      cid: "J06.9",
      crm: "CRM-MG 45213",
      medico: "Dr. Carlos Mendes",
      dias: 0,
      photoDataUrl: PHOTO_DATA_URL,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid image data URL as photoDataUrl", () => {
    const result = AtestadoInputSchema.safeParse({
      cid: "J06.9",
      crm: "CRM-MG 45213",
      medico: "Dr. Carlos Mendes",
      dias: 2,
      photoDataUrl: PHOTO_DATA_URL,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a submission with no photoDataUrl at all", () => {
    const result = AtestadoInputSchema.safeParse({
      cid: "J06.9",
      crm: "CRM-MG 45213",
      medico: "Dr. Carlos Mendes",
      dias: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a photoDataUrl that isn't a data: image URL", () => {
    const result = AtestadoInputSchema.safeParse({
      cid: "J06.9",
      crm: "CRM-MG 45213",
      medico: "Dr. Carlos Mendes",
      dias: 2,
      photoDataUrl: "file:///data/user/0/photo.jpg",
    });
    expect(result.success).toBe(false);
  });
});

describe("AtestadoStatusUpdateSchema", () => {
  it("accepts aprovado", () => {
    expect(AtestadoStatusUpdateSchema.safeParse({ status: "aprovado" }).success).toBe(true);
  });

  it("accepts em_analise, without a reviewNote", () => {
    expect(AtestadoStatusUpdateSchema.safeParse({ status: "em_analise" }).success).toBe(true);
  });

  it("accepts recusado with a reviewNote", () => {
    expect(
      AtestadoStatusUpdateSchema.safeParse({ status: "recusado", reviewNote: "Documento ilegível" })
        .success,
    ).toBe(true);
  });

  it("rejects recusado without a reviewNote", () => {
    expect(AtestadoStatusUpdateSchema.safeParse({ status: "recusado" }).success).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(AtestadoStatusUpdateSchema.safeParse({ status: "enviado" }).success).toBe(false);
  });
});
