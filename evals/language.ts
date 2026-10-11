/**
 * Deterministic reply-language detector for en/es/pt. Scores distinctive
 * function words, chosen so Spanish and Portuguese (which share many words)
 * don't collide. Good enough for short support replies; not a general detector.
 */
export type Lang = "en" | "es" | "pt";

const MARKERS: Record<Lang, string[]> = {
  en: ["the", "and", "you", "your", "we", "our", "will", "with", "thanks", "please", "this", "that", "is", "are"],
  es: ["el", "los", "las", "usted", "su", "gracias", "hola", "equipo", "cuenta", "nuestro", "nuestra", "pronto", "y", "lo", "ha", "puede", "muy"],
  pt: ["você", "seu", "sua", "obrigado", "obrigada", "olá", "equipe", "conta", "nosso", "nossa", "não", "em", "breve", "e", "foi", "pode", "muito"],
};

export function detectLanguage(text: string): Lang {
  const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  const score = (lang: Lang) => words.filter((w) => MARKERS[lang].includes(w)).length;
  const scores: [Lang, number][] = [
    ["en", score("en")],
    ["es", score("es")],
    ["pt", score("pt")],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0]![1] === 0 ? "en" : scores[0]![0];
}
