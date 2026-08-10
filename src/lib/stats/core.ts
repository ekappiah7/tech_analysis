export function sum(xs: number[]): number {
  let total = 0;
  for (const x of xs) total += x;
  return total;
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : sum(xs) / xs.length;
}

/** Sample standard deviation (n - 1 denominator). */
export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let acc = 0;
  for (const x of xs) acc += (x - m) ** 2;
  return Math.sqrt(acc / (xs.length - 1));
}

/** Linear-interpolation quantile on an unsorted array. `q` is in [0, 1]. */
export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * Math.min(Math.max(q, 0), 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function median(xs: number[]): number {
  return quantile(xs, 0.5);
}

/** Sample skewness (Fisher–Pearson, population form on sample moments). */
export function skewness(xs: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const m = mean(xs);
  const s = stdev(xs);
  if (s === 0) return 0;
  let acc = 0;
  for (const x of xs) acc += ((x - m) / s) ** 3;
  return acc / n;
}

/** Non-excess kurtosis. Subtract 3 for the excess form. */
export function kurtosis(xs: number[]): number {
  const n = xs.length;
  if (n < 4) return 3;
  const m = mean(xs);
  const s = stdev(xs);
  if (s === 0) return 3;
  let acc = 0;
  for (const x of xs) acc += ((x - m) / s) ** 4;
  return acc / n;
}

/** Error function, Abramowitz & Stegun 7.1.26. Absolute error < 1.5e-7. */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/** Standard normal CDF. */
export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/**
 * Inverse standard normal CDF (Acklam's rational approximation, refined by one
 * Halley step). Relative error better than 1e-9 across the open unit interval.
 */
export function normalInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let x: number;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    x =
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x =
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  // One Halley refinement against the CDF we actually use downstream.
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/** Log-gamma via the Lanczos approximation (g = 7, n = 9). */
export function logGamma(x: number): number {
  const g = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    // Reflection formula keeps the approximation on its accurate side.
    return (
      Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
    );
  }
  const z = x - 1;
  let a = g[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += g[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued-fraction expansion for the incomplete beta (modified Lentz). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const tiny = 1e-30;
  const epsilon = 3e-12;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;

  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < epsilon) break;
  }
  return h;
}

/** Regularised incomplete beta function I_x(a, b). */
export function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/**
 * Two-sided p-value for Student's t with `df` degrees of freedom.
 *
 * Used rather than a normal approximation because the per-bucket breakdowns
 * routinely have twenty or thirty trades in them, where the normal tail is
 * meaningfully too thin and would manufacture significance that isn't there.
 */
export function studentTTwoSidedP(t: number, df: number): number {
  if (df <= 0 || !Number.isFinite(t)) return 1;
  return incompleteBeta(df / 2, 0.5, df / (df + t * t));
}

/** Two-sided one-sample t-test of `xs` against a mean of zero. */
export function tTestAgainstZero(xs: number[]): { t: number; p: number } {
  const n = xs.length;
  if (n < 2) return { t: 0, p: 1 };
  const s = stdev(xs);
  if (s === 0) return { t: 0, p: 1 };
  const t = mean(xs) / (s / Math.sqrt(n));
  return { t, p: studentTTwoSidedP(t, n - 1) };
}

/**
 * Benjamini–Hochberg step-up procedure. Returns adjusted p-values (q-values) in
 * the same order as the input, each capped at 1 and made monotone.
 */
export function benjaminiHochberg(pValues: number[]): number[] {
  const m = pValues.length;
  if (m === 0) return [];

  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((x, y) => x.p - y.p);

  const adjusted = new Array<number>(m);
  let running = 1;
  for (let rank = m; rank >= 1; rank--) {
    const { p, i } = indexed[rank - 1];
    running = Math.min(running, (p * m) / rank);
    adjusted[i] = Math.min(1, running);
  }
  return adjusted;
}

/** Max peak-to-trough drawdown of a cumulative equity path, as a positive number. */
export function maxDrawdown(equity: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const value of equity) {
    if (value > peak) peak = value;
    const dd = peak - value;
    if (dd > worst) worst = dd;
  }
  return worst;
}

/** Running cumulative sum, starting from `start`, excluding the starting point. */
export function cumulative(xs: number[], start = 0): number[] {
  const out = new Array<number>(xs.length);
  let acc = start;
  for (let i = 0; i < xs.length; i++) {
    acc += xs[i];
    out[i] = acc;
  }
  return out;
}
