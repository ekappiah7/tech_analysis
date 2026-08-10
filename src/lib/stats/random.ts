/**
 * Seeded PRNG. Every simulation in this app is reproducible: the same trade log
 * and the same seed must always produce the same numbers, otherwise "your
 * drawdown is 18%" quietly becomes a different answer on every page load.
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates, returning a new array. */
export function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Draw `size` elements with replacement. */
export function resample(xs: readonly number[], size: number, rng: Rng): number[] {
  const out = new Array<number>(size);
  const n = xs.length;
  for (let i = 0; i < size; i++) {
    out[i] = xs[Math.floor(rng() * n)];
  }
  return out;
}
