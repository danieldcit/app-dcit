import {
  AdmissionDocumentInputSchema,
  AdmissionDocumentStatusUpdateSchema,
  CertificationInputSchema,
} from "./documentos";

const PHOTO_DATA_URL = "data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh";

describe("AdmissionDocumentInputSchema", () => {
  it("accepts a fixed kind with one photo", () => {
    expect(
      AdmissionDocumentInputSchema.safeParse({ kind: "rg", photos: [PHOTO_DATA_URL] }).success,
    ).toBe(true);
  });

  it("accepts up to 3 photos", () => {
    expect(
      AdmissionDocumentInputSchema.safeParse({
        kind: "rg",
        photos: [PHOTO_DATA_URL, PHOTO_DATA_URL, PHOTO_DATA_URL],
      }).success,
    ).toBe(true);
  });

  it("rejects more than 3 photos", () => {
    expect(
      AdmissionDocumentInputSchema.safeParse({
        kind: "rg",
        photos: [PHOTO_DATA_URL, PHOTO_DATA_URL, PHOTO_DATA_URL, PHOTO_DATA_URL],
      }).success,
    ).toBe(false);
  });

  it("rejects a kind with no photos", () => {
    expect(AdmissionDocumentInputSchema.safeParse({ kind: "rg", photos: [] }).success).toBe(false);
  });

  it("rejects a kind outside the fixed list", () => {
    expect(
      AdmissionDocumentInputSchema.safeParse({ kind: "passaporte", photos: [PHOTO_DATA_URL] })
        .success,
    ).toBe(false);
  });

  it("rejects a device-local file:// path instead of a data: URL", () => {
    expect(
      AdmissionDocumentInputSchema.safeParse({
        kind: "rg",
        photos: ["file:///data/user/0/photo.jpg"],
      }).success,
    ).toBe(false);
  });
});

describe("AdmissionDocumentStatusUpdateSchema", () => {
  it("accepts em_analise, without a reviewNote", () => {
    expect(AdmissionDocumentStatusUpdateSchema.safeParse({ status: "em_analise" }).success).toBe(true);
  });

  it("accepts aprovado", () => {
    expect(AdmissionDocumentStatusUpdateSchema.safeParse({ status: "aprovado" }).success).toBe(true);
  });

  it("accepts recusado with a reviewNote", () => {
    expect(
      AdmissionDocumentStatusUpdateSchema.safeParse({ status: "recusado", reviewNote: "Foto ilegível" })
        .success,
    ).toBe(true);
  });

  it("rejects recusado without a reviewNote", () => {
    expect(AdmissionDocumentStatusUpdateSchema.safeParse({ status: "recusado" }).success).toBe(false);
  });
});

describe("CertificationInputSchema", () => {
  it("accepts a valid DD/MM/AAAA date", () => {
    const result = CertificationInputSchema.safeParse({
      name: "AWS Certified",
      institution: "Amazon",
      validUntil: "10/10/2028",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an ISO date instead of DD/MM/AAAA", () => {
    const result = CertificationInputSchema.safeParse({
      name: "AWS Certified",
      institution: "Amazon",
      validUntil: "2028-10-10",
    });
    expect(result.success).toBe(false);
  });
});
