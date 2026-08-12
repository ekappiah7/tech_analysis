import { describe, expect, it } from "vitest";
import { formatAuditReport } from "./report";
import { auditTradeLog } from "@/lib/stats/audit";
import { mulberry32 } from "@/lib/stats/random";
import type { Trade, TradeLog } from "@/lib/types";

function makeLog(pnl: number[]): TradeLog {
  const start = Date.UTC(2026, 0, 2, 9, 0, 0);
  const trades: Trade[] = pnl.map((profit, i) => ({
    id: String(i),
    symbol: i % 2 ? "EURUSD" : "XAUUSD",
    direction: i % 2 ? "long" : "short",
    openTime: start + i * 6 * 3_600_000,
    closeTime: start + i * 6 * 3_600_000 + 3_600_000,
    openPrice: 1,
    closePrice: 1,
    volume: 0.1,
    profit,
    grossProfit: profit,
    commission: 0,
    swap: 0,
  }));
  return { source: "mt4-html", trades, initialBalance: 10_000, warnings: [] };
}

function normalSeries(n: number, mu: number, sigma: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const out: number[] = [];
  while (out.length < n) {
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1));
    out.push(mu + sigma * r * Math.cos(2 * Math.PI * u2));
    out.push(mu + sigma * r * Math.sin(2 * Math.PI * u2));
  }
  return out.slice(0, n);
}

const FAST = { bootstrapIterations: 1500, monteCarloIterations: 600 };

describe("MCP audit report", () => {
  it("tells the reader a profitable-looking no-edge record is not evidence of skill", () => {
    // The failure mode this guards against: a language model reads a positive
    // net P&L, ignores the interval, and reports the strategy as working.
    const log = makeLog(normalSeries(300, 0.5, 60, 1));
    const result = auditTradeLog(log, FAST);
    const report = formatAuditReport(result, log, "test.htm");

    expect(result.verdict.label).toBe("no-evidence-of-edge");
    expect(report).toContain("How to interpret this:");
    expect(report).toContain("not evidence of skill");
  });

  it("refuses to let a short record be read as promising", () => {
    // Fifteen strongly profitable trades — exactly the sample that tempts an
    // over-eager summary. The report must foreclose that reading.
    const log = makeLog(normalSeries(15, 40, 20, 2));
    const report = formatAuditReport(auditTradeLog(log, FAST), log, "short.htm");
    expect(report).toContain("Do not draw any conclusion");
  });

  it("includes the headline table and every breakdown", () => {
    const log = makeLog(normalSeries(200, 12, 40, 3));
    const result = auditTradeLog(log, FAST);
    const report = formatAuditReport(result, log, "test.htm");

    expect(report).toContain("| Trades | 200 |");
    expect(report).toContain("Expectancy per trade");
    for (const breakdown of result.breakdowns) {
      expect(report).toContain(`### ${breakdown.name}`);
    }
  });

  it("states the number of variants the Deflated Sharpe was corrected for", () => {
    const log = makeLog(normalSeries(200, 12, 40, 4));
    const result = auditTradeLog(log, { ...FAST, trialsTested: 250 });
    const report = formatAuditReport(result, log, "test.htm");
    expect(report).toContain("Deflated Sharpe (250 variants tested)");
  });

  it("explains that reordering cannot change the final balance", () => {
    const log = makeLog(normalSeries(120, 5, 40, 5));
    const report = formatAuditReport(auditTradeLog(log, FAST), log, "test.htm");
    expect(report).toContain("path luck only");
  });

  it("says q is the column that matters, not p", () => {
    const log = makeLog(normalSeries(150, 3, 50, 6));
    const report = formatAuditReport(auditTradeLog(log, FAST), log, "test.htm");
    expect(report).toContain("Only q is meaningful");
  });

  it("surfaces importer warnings", () => {
    const log = makeLog(normalSeries(60, 5, 30, 7));
    log.warnings.push("Broker server time, not UTC.");
    const report = formatAuditReport(auditTradeLog(log, FAST), log, "test.htm");
    expect(report).toContain("Notes on the source data");
    expect(report).toContain("Broker server time, not UTC.");
  });
});
