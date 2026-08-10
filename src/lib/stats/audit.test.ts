import { describe, expect, it } from "vitest";
import { auditTradeLog } from "./audit";
import { mulberry32 } from "./random";
import type { Trade, TradeLog } from "@/lib/types";

const HOUR = 3_600_000;

function makeLog(pnl: number[], symbols = ["EURUSD", "XAUUSD"]): TradeLog {
  const start = Date.UTC(2024, 0, 2, 9, 0, 0);
  const trades: Trade[] = pnl.map((profit, i) => ({
    id: String(i),
    symbol: symbols[i % symbols.length],
    direction: i % 2 === 0 ? "long" : "short",
    openTime: start + i * 6 * HOUR,
    closeTime: start + i * 6 * HOUR + 2 * HOUR,
    openPrice: 1,
    closePrice: 1,
    volume: 0.1,
    profit,
    grossProfit: profit,
    commission: 0,
    swap: 0,
  }));
  return { source: "generic-csv", trades, initialBalance: 10_000, warnings: [] };
}

function normalSeries(n: number, mu: number, sigma: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const out: number[] = [];
  while (out.length < n) {
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const radius = Math.sqrt(-2 * Math.log(u1));
    out.push(mu + sigma * radius * Math.cos(2 * Math.PI * u2));
    out.push(mu + sigma * radius * Math.sin(2 * Math.PI * u2));
  }
  return out.slice(0, n);
}

const FAST = { bootstrapIterations: 2000, monteCarloIterations: 800 };

describe("end-to-end audit", () => {
  it("refuses to judge a short track record", () => {
    const result = auditTradeLog(makeLog(normalSeries(12, 50, 30, 1)), FAST);
    expect(result.verdict.label).toBe("insufficient-data");
    expect(result.verdict.headline).toContain("not enough");
  });

  it("finds no edge in a zero-expectancy record", () => {
    const result = auditTradeLog(makeLog(normalSeries(300, 0, 50, 2)), FAST);
    expect(result.verdict.label).toBe("no-evidence-of-edge");
    expect(result.expectancy.lower).toBeLessThanOrEqual(0);
  });

  it("supports a strong, broadly-based edge", () => {
    const result = auditTradeLog(makeLog(normalSeries(400, 25, 40, 3)), FAST);
    expect(result.verdict.label).toBe("edge-supported");
    expect(result.expectancy.lower).toBeGreaterThan(0);
    expect(result.verdict.reasons.join(" ")).toContain("unlikely to be pure chance");
  });

  it("downgrades a profitable record that rests on a few outliers", () => {
    // Consistent small losses, rescued by three enormous winners.
    const pnl = [...Array(97).fill(-20), 900, 950, 1000];
    const result = auditTradeLog(makeLog(pnl), FAST);
    expect(result.netPnl).toBeGreaterThan(0);
    expect(result.concentration.fragile).toBe(true);
    expect(result.verdict.label).not.toBe("edge-supported");
    expect(result.verdict.cautions.join(" ")).toContain("best 5% of trades");
  });

  it("penalises a strategy selected from many variants", () => {
    const pnl = normalSeries(200, 9, 50, 4);
    const honest = auditTradeLog(makeLog(pnl), { ...FAST, trialsTested: 1 });
    const dredged = auditTradeLog(makeLog(pnl), { ...FAST, trialsTested: 400 });
    expect(dredged.sharpe.dsr).toBeLessThan(honest.sharpe.dsr);
    expect(dredged.verdict.reasons.join(" ")).toContain("400 variants");
  });

  it("is deterministic for a given seed", () => {
    const log = makeLog(normalSeries(150, 10, 45, 5));
    const a = auditTradeLog(log, { ...FAST, seed: 7 });
    const b = auditTradeLog(log, { ...FAST, seed: 7 });
    expect(a.expectancy).toEqual(b.expectancy);
    expect(a.drawdown).toEqual(b.drawdown);
    expect(a.projection).toEqual(b.projection);
  });

  it("builds an equity curve from the opening balance", () => {
    const result = auditTradeLog(makeLog([100, -50, 25]), FAST);
    expect(result.equityCurve.map((p) => p.equity)).toEqual([10100, 10050, 10075]);
  });

  it("summarises headline numbers", () => {
    const result = auditTradeLog(makeLog([100, -50, 100, -50]), FAST);
    expect(result.n).toBe(4);
    expect(result.netPnl).toBeCloseTo(100, 6);
    expect(result.winRate).toBeCloseTo(0.5, 6);
    expect(result.profitFactor).toBeCloseTo(2, 6);
  });

  it("corrects for multiple testing across breakdown buckets", () => {
    const result = auditTradeLog(makeLog(normalSeries(300, 0, 50, 6)), FAST);
    for (const breakdown of result.breakdowns) {
      for (const bucket of breakdown.buckets) {
        expect(bucket.qValue).toBeGreaterThanOrEqual(bucket.pValue - 1e-12);
      }
    }
    // Slicing a no-edge record five ways must not surface a "winning" segment.
    const flagged = result.breakdowns
      .flatMap((b) => b.buckets)
      .filter((b) => b.significant);
    expect(flagged).toHaveLength(0);
  });

  it("marks thin buckets as underpowered", () => {
    const result = auditTradeLog(makeLog(normalSeries(40, 10, 30, 7)), FAST);
    const symbols = result.breakdowns.find((b) => b.name === "Symbol")!;
    expect(symbols.buckets.every((b) => b.underpowered)).toBe(true);
  });

  it("survives an empty log without throwing", () => {
    const result = auditTradeLog(makeLog([]), FAST);
    expect(result.n).toBe(0);
    expect(result.verdict.label).toBe("insufficient-data");
  });
});
