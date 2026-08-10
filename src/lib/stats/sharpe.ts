import type { SharpeResult } from "@/lib/types";
import { kurtosis, mean, normalCdf, normalInv, skewness, stdev } from "./core";

const EULER_MASCHERONI = 0.5772156649015329;
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Sampling variance of the Sharpe estimator under non-normal returns
 * (Mertens / Bailey–López de Prado). This is the denominator that makes a
 * Sharpe from fat-tailed, negatively skewed returns count for less than the
 * same number from well-behaved ones — which is the entire point, because
 * option-selling and martingale strategies produce beautiful Sharpes right up
 * until they don't.
 */
function sharpeVariance(sr: number, skew: number, kurt: number, n: number): number {
  if (n < 2) return Infinity;
  return (1 - skew * sr + ((kurt - 1) / 4) * sr * sr) / (n - 1);
}

/**
 * Probabilistic Sharpe Ratio: the probability that the true Sharpe exceeds
 * `benchmark`, given the observed Sharpe, the sample size, and the shape of the
 * return distribution.
 */
export function probabilisticSharpe(
  sr: number,
  benchmark: number,
  skew: number,
  kurt: number,
  n: number,
): number {
  const variance = sharpeVariance(sr, skew, kurt, n);
  if (!Number.isFinite(variance) || variance <= 0) return 0;
  return normalCdf((sr - benchmark) / Math.sqrt(variance));
}

/**
 * The Sharpe you would expect to see from the *best* of `trials` strategies that
 * all genuinely have zero edge. Testing 200 parameter combinations and keeping
 * the winner is not research, it is a selection process, and this is the bar
 * that selection alone will clear.
 */
export function expectedMaxSharpe(trials: number, sharpeVar: number): number {
  if (trials <= 1) return 0;
  const sd = Math.sqrt(Math.max(sharpeVar, 0));
  const a = normalInv(1 - 1 / trials);
  const b = normalInv(1 - 1 / (trials * Math.E));
  return sd * ((1 - EULER_MASCHERONI) * a + EULER_MASCHERONI * b);
}

export function analyseSharpe(
  pnl: number[],
  span: { from: number; to: number },
  trialsTested = 1,
): SharpeResult {
  const n = pnl.length;
  const m = mean(pnl);
  const s = stdev(pnl);
  const perTrade = s === 0 ? 0 : m / s;
  const skew = skewness(pnl);
  const kurt = kurtosis(pnl);

  const years = Math.max((span.to - span.from) / MS_PER_YEAR, 1 / 365.25);
  const tradesPerYear = n / years;
  const annualised = perTrade * Math.sqrt(tradesPerYear);

  const variance = sharpeVariance(perTrade, skew, kurt, n);
  const psr = probabilisticSharpe(perTrade, 0, skew, kurt, n);
  const benchmark = expectedMaxSharpe(trialsTested, variance);
  const dsr = probabilisticSharpe(perTrade, benchmark, skew, kurt, n);

  return {
    perTrade,
    annualised,
    tradesPerYear,
    skew,
    kurtosis: kurt,
    psr,
    dsr,
    trialsTested,
  };
}
