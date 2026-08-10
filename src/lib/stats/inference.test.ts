import { describe, expect, it } from "vitest";
import { bootstrapMean } from "./bootstrap";
import { permutationDrawdown, projectForward } from "./montecarlo";
import { analyseSharpe, expectedMaxSharpe, probabilisticSharpe } from "./sharpe";
import { analyseConcentration } from "./luck";
import { analyseStreaks } from "./streaks";
import { mulberry32 } from "./random";
import { sum } from "./core";

/** Deterministic standard-normal draws via Box–Muller, for synthetic track records. */
function normalSeries(n: number, mu: number, sigma: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const out: number[] = [];
  while (out.length < n) {
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const radius = Math.sqrt(-2 * Math.log(u1));
    out.push(mu + sigma * radius * Math.cos(2 * Math.PI * u2));
    if (out.length < n) {
      out.push(mu + sigma * radius * Math.sin(2 * Math.PI * u2));
    }
  }
  return out.slice(0, n);
}

describe("bootstrap expectancy", () => {
  it("is reproducible for a given seed", () => {
    const values = normalSeries(200, 5, 50, 1);
    const a = bootstrapMean(values, { iterations: 2000, rng: mulberry32(99) });
    const b = bootstrapMean(values, { iterations: 2000, rng: mulberry32(99) });
    expect(a).toEqual(b);
  });

  it("detects a genuine edge", () => {
    // 400 trades averaging +20 with sd 50: a real, clearly positive edge.
    const values = normalSeries(400, 20, 50, 2);
    const result = bootstrapMean(values, { iterations: 4000, rng: mulberry32(3) });
    expect(result.lower).toBeGreaterThan(0);
    expect(result.pValue).toBeLessThan(0.01);
  });

  it("does NOT manufacture an edge from a coin-flip record", () => {
    // The load-bearing test for this whole product: a strategy with exactly zero
    // expectancy must not be reported as profitable, however the sample fell.
    let falsePositives = 0;
    for (let seed = 0; seed < 20; seed++) {
      const values = normalSeries(300, 0, 50, 1000 + seed);
      const result = bootstrapMean(values, {
        iterations: 2000,
        rng: mulberry32(seed),
      });
      if (result.lower > 0) falsePositives++;
    }
    // At a 95% CI we tolerate the nominal 5% error rate, not more.
    expect(falsePositives).toBeLessThanOrEqual(2);
  });

  it("brackets the sample mean with its interval", () => {
    const values = normalSeries(150, 12, 40, 4);
    const result = bootstrapMean(values, { iterations: 2000, rng: mulberry32(5) });
    expect(result.estimate).toBeGreaterThan(result.lower);
    expect(result.estimate).toBeLessThan(result.upper);
  });

  it("degrades gracefully on tiny samples", () => {
    expect(bootstrapMean([]).pValue).toBe(1);
    expect(bootstrapMean([7]).estimate).toBe(7);
  });
});

describe("permutation drawdown", () => {
  const pnl = normalSeries(200, 3, 40, 11);

  it("never changes the total, only the path", () => {
    // Currency P&L is additive, so reordering cannot alter the final balance.
    // This is why the projection uses resampling instead.
    const result = permutationDrawdown(pnl, { iterations: 300, rng: mulberry32(1) });
    expect(result.observed).toBeGreaterThanOrEqual(0);
    expect(sum(pnl)).toBeCloseTo(sum([...pnl].reverse()), 8);
  });

  it("produces an ordered quantile ladder", () => {
    const { quantiles } = permutationDrawdown(pnl, {
      iterations: 500,
      rng: mulberry32(2),
    });
    expect(quantiles.p50).toBeLessThanOrEqual(quantiles.p75);
    expect(quantiles.p75).toBeLessThanOrEqual(quantiles.p90);
    expect(quantiles.p90).toBeLessThanOrEqual(quantiles.p95);
    expect(quantiles.p95).toBeLessThanOrEqual(quantiles.p99);
  });

  it("places the observed drawdown somewhere in the distribution", () => {
    const result = permutationDrawdown(pnl, { iterations: 500, rng: mulberry32(3) });
    expect(result.observedPercentile).toBeGreaterThanOrEqual(0);
    expect(result.observedPercentile).toBeLessThanOrEqual(1);
  });

  it("reports no drawdown for a strategy that never loses", () => {
    const result = permutationDrawdown([1, 2, 3], {
      iterations: 50,
      rng: mulberry32(4),
    });
    expect(result.observed).toBe(0);
  });
});

describe("forward projection", () => {
  it("widens the outcome distribution rather than collapsing it", () => {
    const pnl = normalSeries(200, 5, 60, 21);
    const projection = projectForward(pnl, {
      horizon: 100,
      iterations: 2000,
      rng: mulberry32(6),
    });
    expect(projection.finalPnl.p05).toBeLessThan(projection.finalPnl.p50);
    expect(projection.finalPnl.p50).toBeLessThan(projection.finalPnl.p95);
    expect(projection.maxDrawdown.p50).toBeLessThanOrEqual(projection.maxDrawdown.p99);
  });

  it("gives a break-even strategy roughly even odds of losing", () => {
    const pnl = normalSeries(300, 0, 50, 22);
    const projection = projectForward(pnl, {
      horizon: 100,
      iterations: 3000,
      rng: mulberry32(7),
    });
    expect(projection.probabilityOfLoss).toBeGreaterThan(0.3);
    expect(projection.probabilityOfLoss).toBeLessThan(0.7);
  });

  it("still warns of losing runs for a profitable strategy", () => {
    const pnl = normalSeries(300, 10, 60, 23);
    const projection = projectForward(pnl, {
      horizon: 200,
      iterations: 2000,
      rng: mulberry32(8),
    });
    expect(projection.maxDrawdown.p95).toBeGreaterThan(0);
  });
});

describe("Sharpe deflation", () => {
  it("raises the bar as more variants are tried", () => {
    const single = expectedMaxSharpe(1, 0.01);
    const many = expectedMaxSharpe(100, 0.01);
    expect(single).toBe(0);
    expect(many).toBeGreaterThan(0);
    expect(expectedMaxSharpe(1000, 0.01)).toBeGreaterThan(many);
  });

  it("penalises a strategy picked from many attempts", () => {
    const pnl = normalSeries(250, 8, 50, 31);
    const span = { from: 0, to: 365.25 * 24 * 3600 * 1000 };
    const honest = analyseSharpe(pnl, span, 1);
    const dredged = analyseSharpe(pnl, span, 500);
    expect(dredged.dsr).toBeLessThan(honest.dsr);
    expect(honest.dsr).toBeCloseTo(honest.psr, 10);
  });

  it("increases confidence with sample size", () => {
    const short = probabilisticSharpe(0.2, 0, 0, 3, 30);
    const long = probabilisticSharpe(0.2, 0, 0, 3, 500);
    expect(long).toBeGreaterThan(short);
  });

  it("discounts negatively skewed, fat-tailed returns", () => {
    const clean = probabilisticSharpe(0.2, 0, 0, 3, 200);
    const ugly = probabilisticSharpe(0.2, 0, -1.5, 12, 200);
    expect(ugly).toBeLessThan(clean);
  });
});

describe("concentration", () => {
  it("flags an account carried by a few outliers", () => {
    // Twenty small losses funded entirely by one enormous winner.
    const pnl = [...Array(20).fill(-10), 500];
    const result = analyseConcentration(pnl);
    expect(result.totalPnl).toBe(300);
    expect(result.fragile).toBe(true);
    expect(result.topTradeShare).toBeCloseTo(1, 10);
  });

  it("leaves a broadly-based record unflagged", () => {
    const pnl = normalSeries(300, 15, 20, 41);
    const result = analyseConcentration(pnl);
    expect(result.fragile).toBe(false);
    expect(result.top5PercentShare).toBeLessThan(0.5);
  });

  it("computes gross profit and loss separately", () => {
    const result = analyseConcentration([10, -4, 6, -2]);
    expect(result.grossProfit).toBe(16);
    expect(result.grossLoss).toBe(6);
  });
});

describe("streaks", () => {
  it("detects clustering in a heavily grouped sequence", () => {
    // Ten wins then ten losses: far fewer runs than independence predicts.
    const pnl = [...Array(10).fill(1), ...Array(10).fill(-1)];
    const result = analyseStreaks(pnl);
    expect(result.longestWin).toBe(10);
    expect(result.longestLoss).toBe(10);
    expect(result.runs).toBe(2);
    expect(result.runsPValue).toBeLessThan(0.05);
  });

  it("does not flag an independent-looking sequence", () => {
    const pnl = normalSeries(200, 0, 10, 51);
    const result = analyseStreaks(pnl);
    expect(result.runsPValue).toBeGreaterThan(0.05);
  });

  it("handles an all-winning record without dividing by zero", () => {
    const result = analyseStreaks([1, 2, 3]);
    expect(result.longestWin).toBe(3);
    expect(result.runsPValue).toBe(1);
  });
});
