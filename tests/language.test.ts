import { describe, expect, it } from "vitest";
import { ORACLE_REPLIES } from "../evals/clients.js";
import { detectLanguage } from "../evals/language.js";

describe("detectLanguage", () => {
  it.each([
    ["en", "Thanks for reaching out. Our team will review your account and follow up shortly."],
    ["es", "Hola, gracias por escribirnos. Nuestro equipo revisará su cuenta y le responderá pronto."],
    ["pt", "Olá, obrigado pelo contato. Nossa equipe vai analisar a sua conta e retornará em breve."],
    ["es", "Lamentamos el problema. Puede restablecer la contraseña desde la página de inicio de sesión."],
    ["pt", "Você pode redefinir a senha na página de login. Não compartilhe o link com ninguém."],
  ] as const)("detects %s", (lang, text) => {
    expect(detectLanguage(text)).toBe(lang);
  });

  it("does not mistake an English reply that names a Spanish customer for Spanish", () => {
    expect(detectLanguage("Hi Clínica Sol team, thanks for the report. We will review it and get back to you.")).toBe("en");
  });

  it("agrees with the oracle's reply in every language", () => {
    for (const [lang, reply] of Object.entries(ORACLE_REPLIES)) expect(detectLanguage(reply)).toBe(lang);
  });
});
