import { describe, expect, it } from "vitest";
import { parseTradeFile } from "./index";
import { parseMetaTraderHtml } from "./metatrader";
import { parseTradingViewCsv } from "./tradingview";
import { parseGenericCsv } from "./generic";
import { parseCsv, parseNumber, parseTimestamp } from "./csv";
import {
  GENERIC_CSV,
  MT4_STATEMENT,
  MT5_REPORT,
  TRADINGVIEW_CSV,
} from "./fixtures";

describe("CSV primitives", () => {
  it("handles quoted fields, escaped quotes and embedded commas", () => {
    const rows = parseCsv('a,"b,c","say ""hi"""\n1,2,3');
    expect(rows[0]).toEqual(["a", "b,c", 'say "hi"']);
    expect(rows[1]).toEqual(["1", "2", "3"]);
  });

  it("strips a UTF-8 BOM", () => {
    expect(parseCsv("﻿a,b\n1,2")[0]).toEqual(["a", "b"]);
  });

  it("reads broker number formats", () => {
    expect(parseNumber("1 234.56")).toBeCloseTo(1234.56, 6);
    expect(parseNumber("1 234.56")).toBeCloseTo(1234.56, 6);
    expect(parseNumber("1,234.56")).toBeCloseTo(1234.56, 6);
    expect(parseNumber("-570.00")).toBeCloseTo(-570, 6);
    // A lone comma with two trailing digits is a decimal separator.
    expect(parseNumber("1234,56")).toBeCloseTo(1234.56, 6);
    // With more than two, it is grouping.
    expect(parseNumber("1,234")).toBeCloseTo(1234, 6);
    expect(parseNumber("")).toBeNaN();
  });

  it("reads the date formats these exports use", () => {
    expect(parseTimestamp("2024.03.04 13:45:00")).toBe(
      Date.UTC(2024, 2, 4, 13, 45, 0),
    );
    expect(parseTimestamp("2024-01-03 09:00:00")).toBe(
      Date.UTC(2024, 0, 3, 9, 0, 0),
    );
    expect(parseTimestamp("15/03/2024 09:30")).toBe(
      Date.UTC(2024, 2, 15, 9, 30, 0),
    );
    expect(parseTimestamp("")).toBeNaN();
  });
});

describe("MetaTrader 4 statements", () => {
  const log = parseMetaTraderHtml(MT4_STATEMENT);

  it("identifies the format", () => {
    expect(log.source).toBe("mt4-html");
  });

  it("reads only the closed trades", () => {
    // Four buy/sell rows, but one has no close time: still open.
    expect(log.trades).toHaveLength(3);
    expect(log.warnings.some((w) => w.includes("had not closed yet"))).toBe(true);
  });

  it("picks up the opening deposit from the colspan'd balance row", () => {
    expect(log.initialBalance).toBeCloseTo(5000, 6);
  });

  it("folds commission, taxes and swap into net profit", () => {
    const trade = log.trades.find((t) => t.id === "100002")!;
    // 195.00 gross, less 4.00 commission and 1.20 swap.
    expect(trade.grossProfit).toBeCloseTo(195, 6);
    expect(trade.profit).toBeCloseTo(189.8, 6);
  });

  it("normalises symbol case and reads direction", () => {
    const trade = log.trades.find((t) => t.id === "100003")!;
    expect(trade.symbol).toBe("XAUUSD");
    expect(trade.direction).toBe("short");
    expect(trade.profit).toBeCloseTo(-581.5, 6);
  });

  it("parses space-separated thousands", () => {
    const trade = log.trades.find((t) => t.id === "100004")!;
    expect(trade.grossProfit).toBeCloseTo(1240.5, 6);
  });

  it("warns that timestamps are broker server time", () => {
    expect(log.warnings.some((w) => w.includes("server time"))).toBe(true);
  });
});

describe("MetaTrader 5 reports", () => {
  const log = parseMetaTraderHtml(MT5_REPORT);

  it("identifies the format", () => {
    expect(log.source).toBe("mt5-html");
    expect(log.trades).toHaveLength(3);
  });

  it("resolves the duplicated Time and Price columns positionally", () => {
    const trade = log.trades.find((t) => t.id === "7001")!;
    expect(trade.openTime).toBe(Date.UTC(2024, 4, 2, 7, 30, 0));
    expect(trade.closeTime).toBe(Date.UTC(2024, 4, 2, 15, 10, 0));
    expect(trade.openPrice).toBeCloseTo(1.2563, 6);
    expect(trade.closePrice).toBeCloseTo(1.26010, 6);
  });

  it("reads CFD index symbols", () => {
    const trade = log.trades.find((t) => t.id === "7002")!;
    expect(trade.symbol).toBe("US30");
    expect(trade.direction).toBe("short");
    expect(trade.profit).toBeCloseTo(-75, 6);
  });
});

describe("TradingView exports", () => {
  const log = parseTradingViewCsv(TRADINGVIEW_CSV);

  it("pairs entry and exit rows into single trades", () => {
    expect(log.source).toBe("tradingview-csv");
    expect(log.trades).toHaveLength(3);
  });

  it("takes P&L from the exit row and direction from the entry row", () => {
    const [first, second] = log.trades;
    expect(first.direction).toBe("long");
    expect(first.profit).toBeCloseTo(82.95, 6);
    expect(second.direction).toBe("short");
    expect(second.profit).toBeCloseTo(-41.05, 6);
  });

  it("uses entry and exit prices from the right rows", () => {
    const first = log.trades[0];
    expect(first.openPrice).toBeCloseTo(42150.5, 4);
    expect(first.closePrice).toBeCloseTo(42980.0, 4);
  });

  it("warns about missing symbols and simulated fills", () => {
    expect(log.warnings.some((w) => w.includes("instrument name"))).toBe(true);
    expect(log.warnings.some((w) => w.includes("simulated fills"))).toBe(true);
  });
});

describe("generic CSV fallback", () => {
  const log = parseGenericCsv(GENERIC_CSV);

  it("maps columns by alias", () => {
    expect(log.trades).toHaveLength(3);
    expect(log.trades[0].symbol).toBe("EURUSD");
    expect(log.trades[0].direction).toBe("long");
    expect(log.trades[1].direction).toBe("short");
  });

  it("treats the profit column as already net of costs", () => {
    expect(log.trades[0].profit).toBeCloseTo(35, 6);
    expect(log.trades[0].grossProfit).toBeCloseTo(36.5, 6);
    expect(log.warnings.some((w) => w.includes("already net of costs"))).toBe(true);
  });

  it("refuses a file with no profit column", () => {
    const bad = parseGenericCsv("Symbol,Date\nEURUSD,2024-01-01");
    expect(bad.trades).toHaveLength(0);
    expect(bad.warnings[0]).toContain("Could not find a profit column");
  });
});

describe("format detection", () => {
  it("routes each fixture to the right importer", () => {
    expect(parseTradeFile(MT4_STATEMENT, "statement.htm").source).toBe("mt4-html");
    expect(parseTradeFile(MT5_REPORT, "report.html").source).toBe("mt5-html");
    expect(parseTradeFile(TRADINGVIEW_CSV, "trades.csv").source).toBe(
      "tradingview-csv",
    );
    expect(parseTradeFile(GENERIC_CSV, "mylog.csv").source).toBe("generic-csv");
  });

  it("explains itself when it cannot read a file at all", () => {
    const log = parseTradeFile("just some prose, no table here", "notes.txt");
    expect(log.trades).toHaveLength(0);
    expect(log.warnings.join(" ")).toContain("notes.txt");
  });
});
