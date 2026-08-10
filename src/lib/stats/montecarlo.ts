import type { DrawdownDistribution, ForwardProjection } from "@/lib/types";
import { maxDrawdown, quantile } from "./core";
import { mulberry32, shuffle, type Rng } from "./random";

/**
 * Drawdown distribution under random re-ordering of the trades you actually took.
 *
 * Note what this does and does not vary. Currency P&L is additive, so every
 * permutation ends at the identical final balance — reordering cannot change
 * the total. What it changes is the *path*, and therefore the drawdown. So this
 * answers exactly one question: "was my worst losing run typical for a strategy
 * like mine, or did I get a kind ordering?"
 *
 * For "what might the next N trades do", use `projectForward` instead — that one
 * resamples with replacement and does vary the total.
 */
export function permutationDrawdown(
  pnl: number[],
  options: { iterations?: number; rng?: Rng } = {},
): DrawdownDistribution {
  const iterations = options.iterations ?? 5_000;
  const rng = options.rng ?? mulberry32(7);

  if (pnl.length === 0) {
    return {
      observed: 0,
      quantiles: { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 },
      observedPercentile: 0,
      iterations: 0,
    };
  }

  const equityOf = (series: number[]) => {
    const out = new Array<number>(series.length);
    let acc = 0;
    for (let i = 0; i < series.length; i++) {
      acc += series[i];
      out[i] = acc;
    }
    return out;
  };

  const observed = maxDrawdown(equityOf(pnl));

  const draws = new Array<number>(iterations);
  let atOrBelowObserved = 0;
  for (let i = 0; i < iterations; i++) {
    const dd = maxDrawdown(equityOf(shuffle(pnl, rng)));
    draws[i] = dd;
    if (dd <= observed) atOrBelowObserved++;
  }

  return {
    observed,
    quantiles: {
      p50: quantile(draws, 0.5),
      p75: quantile(draws, 0.75),
      p90: quantile(draws, 0.9),
      p95: quantile(draws, 0.95),
      p99: quantile(draws, 0.99),
    },
    observedPercentile: atOrBelowObserved / iterations,
    iterations,
  };
}

/**
 * Bootstrap projection of the next `horizon` trades, drawn with replacement from
 * the realised P&L distribution.
 *
 * The assumption being made — and it is a strong one — is that future trades are
 * independent draws from the same distribution as past ones. That fails if the
 * strategy is regime-dependent or if the trader's behaviour drifts. Treat the
 * spread as a floor on the uncertainty, never a ceiling.
 */
export function projectForward(
  pnl: number[],
  options: { horizon?: number; iterations?: number; rng?: Rng } = {},
): ForwardProjection {
  const horizon = options.horizon ?? Math.max(50, pnl.length);
  const iterations = options.iterations ?? 5_000;
  const rng = options.rng ?? mulberry32(13);

  if (pnl.length === 0) {
    return {
      horizon,
      finalPnl: { p05: 0, p25: 0, p50: 0, p75: 0, p95: 0 },
      maxDrawdown: { p50: 0, p90: 0, p95: 0, p99: 0 },
      probabilityOfLoss: 0,
      iterations: 0,
    };
  }

  const n = pnl.length;
  const finals = new Array<number>(iterations);
  const drawdowns = new Array<number>(iterations);
  let negative = 0;

  for (let iter = 0; iter < iterations; iter++) {
    let acc = 0;
    let peak = 0;
    let worst = 0;
    for (let step = 0; step < horizon; step++) {
      acc += pnl[Math.floor(rng() * n)];
      if (acc > peak) peak = acc;
      const dd = peak - acc;
      if (dd > worst) worst = dd;
    }
    finals[iter] = acc;
    drawdowns[iter] = worst;
    if (acc < 0) negative++;
  }

  return {
    horizon,
    finalPnl: {
      p05: quantile(finals, 0.05),
      p25: quantile(finals, 0.25),
      p50: quantile(finals, 0.5),
      p75: quantile(finals, 0.75),
      p95: quantile(finals, 0.95),
    },
    maxDrawdown: {
      p50: quantile(drawdowns, 0.5),
      p90: quantile(drawdowns, 0.9),
      p95: quantile(drawdowns, 0.95),
      p99: quantile(drawdowns, 0.99),
    },
    probabilityOfLoss: negative / iterations,
    iterations,
  };
}
