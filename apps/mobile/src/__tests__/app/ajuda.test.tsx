import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

function fakeJwt(claims: Record<string, unknown>) {
  const BASE64URL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function encode(value: string) {
    const bytes = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
    let bits = "";
    for (let i = 0; i < bytes.length; i++) bits += bytes.charCodeAt(i).toString(2).padStart(8, "0");
    let out = "";
    for (let i = 0; i + 6 <= bits.length; i += 6) out += BASE64URL_CHARS[parseInt(bits.slice(i, i + 6), 2)];
    const remainder = bits.length % 6;
    if (remainder) out += BASE64URL_CHARS[parseInt(bits.slice(-remainder).padEnd(6, "0"), 2)];
    return out;
  }
  return `${encode("{}")}.${encode(JSON.stringify(claims))}.signature`;
}

describe("ajuda screen", () => {
  it("shows role-neutral categories to a colaborador and hides the gestor/rh-only one", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/ajuda" });

    await waitFor(() => {
      expect(screen.getByText("Ponto")).toBeTruthy();
    });
    expect(screen.getByText("Minha Conta")).toBeTruthy();
    expect(screen.queryByText("Para gestores e RH")).toBeNull();
    expect(screen.queryByText("O que aparece em Aprovações?")).toBeNull();
  });

  it("shows the gestor/rh-only category to a gestor", async () => {
    await saveSessionToken(fakeJwt({ sub: "gestor-1", role: "gestor", name: "Bruno Gestor" }));

    renderRouter("src/app", { initialUrl: "/ajuda" });

    await waitFor(() => {
      expect(screen.getByText("Para gestores e RH")).toBeTruthy();
    });
    expect(screen.getByText("O que aparece em Aprovações?")).toBeTruthy();
  });

  it("expands an answer on tap", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/ajuda" });
    await waitFor(() => {
      expect(screen.getByText("Como eu bato o ponto?")).toBeTruthy();
    });
    expect(screen.queryByText(/Toque em "Bater Ponto" na tela inicial/)).toBeNull();

    fireEvent.press(screen.getByText("Como eu bato o ponto?"));

    expect(screen.getByText(/Toque em "Bater Ponto" na tela inicial/)).toBeTruthy();
  });

  it("is reachable from the Perfil screen's menu", async () => {
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    await waitFor(() => {
      expect(screen).toHavePathname("/perfil");
    });

    fireEvent.press(screen.getByText("Central de Ajuda"));

    await waitFor(() => {
      expect(screen).toHavePathname("/ajuda");
    });
  });
});
