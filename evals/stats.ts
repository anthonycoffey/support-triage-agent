/** Wilson score interval for a proportion: well-behaved at 0%, 100% and small n. */
export function wilson(passes: number, n: number, z = 1.96): { rate: number; lo: number; hi: number } {
  if (n === 0) return { rate: NaN, lo: NaN, hi: NaN };
  const p = passes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { rate: p, lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

/** USD per million tokens. Cost is derived from recorded usage and the row's served model. */
export const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

export function costUsd(
  model: string,
  u: { input: number; output: number; cacheRead?: number; cacheWrite?: number },
): number | null {
  const p = PRICING[model];
  if (!p) return null;
  return (u.input * p.input + u.output * p.output + (u.cacheRead ?? 0) * p.cacheRead + (u.cacheWrite ?? 0) * p.cacheWrite) / 1e6;
}

export const pct = (x: number) => (Number.isNaN(x) ? "n/a" : `${(x * 100).toFixed(1)}%`);
