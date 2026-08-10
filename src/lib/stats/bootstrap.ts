import type { BootstrapResult } from "@/lib/types";
import { mean } from "./core";
import { mulberry32, type Rng } from "./random";

/**
 * Percentile bootstrap for the mean of a sample — here, expectancy per trade.
 *
 * The p-value is the two-sided bootstrap percentile p-value against a null of
 * zero expectancy: the share of resampled means falling on the wrong side of
 * zero, doubled. It answers "could a sample this good come from a strategy with
 * no edge at all?", which is the only question a trading track record can
 * honestly be asked.
 */
export function bootstrapMean(
  values: number[],
  options: { iterations?: number; alpha?: number; rng?: Rng } = {},
): BootstrapResult {
  const iterations = options.iterations ?? 10_000;
  const alpha = options.alpha ?? 0.05;
  const rng = options.rng ?? mulberry32(42);
  const n = values.length;

  if (n === 0) {
    return { estimate: 0, lower: 0, upper: 0, pValue: 1, iterations: 0 };
  }
  if (n === 1) {
    return {
      estimate: values[0],
      lower: values[0],
      upper: values[0],
      pValue: 1,
      iterations: 0,
    };
  }

  const means = new Float64Array(iterations);
  let atOrBelowZero = 0;
  let atOrAboveZero = 0;

  for (let iter = 0; iter < iterations; iter++) {
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc += values[Math.floor(rng() * n)];
    }
    const m = acc / n;
    means[iter] = m;
    if (m <= 0) atOrBelowZero++;
    if (m >= 0) atOrAboveZero++;
  }

  means.sort();

  const pick = (q: number) => {
    const pos = (iterations - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return means[lo];
    return means[lo] + (means[hi] - means[lo]) * (pos - lo);
  };

  const oneSided = Math.min(atOrBelowZero, atOrAboveZero) / iterations;

  return {
    estimate: mean(values),
    lower: pick(alpha / 2),
    upper: pick(1 - alpha / 2),
    pValue: Math.min(1, 2 * oneSided),
    iterations,
  };
}
