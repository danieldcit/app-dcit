import { AvatarUploadInputSchema } from "./avatar";

const PHOTO_DATA_URL = "data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh";

describe("AvatarUploadInputSchema", () => {
  it("accepts a valid photo data: URL", () => {
    expect(AvatarUploadInputSchema.safeParse({ photo: PHOTO_DATA_URL }).success).toBe(true);
  });

  it("rejects a device-local file:// path instead of a data: URL", () => {
    expect(
      AvatarUploadInputSchema.safeParse({ photo: "file:///data/user/0/photo.jpg" }).success,
    ).toBe(false);
  });

  it("rejects a missing photo", () => {
    expect(AvatarUploadInputSchema.safeParse({}).success).toBe(false);
  });
});
