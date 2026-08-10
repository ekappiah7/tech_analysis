import { describe, expect, it } from "vitest";
import { resolveSymbol } from "./symbols";

describe("symbol resolution", () => {
  it("routes forex pairs to Twelve Data in slash form", () => {
    const result = resolveSymbol("EURUSD");
    expect(result.resolved).toBe("EUR/USD");
    expect(result.provider).toBe("twelvedata");
    expect(result.assetClass).toBe("forex");
    expect(result.isProxy).toBe(false);
  });

  it("routes crypto to Binance without a key", () => {
    const result = resolveSymbol("BTCUSDT");
    expect(result.resolved).toBe("BTCUSDT");
    expect(result.provider).toBe("binance");
    expect(result.isProxy).toBe(false);
  });

  it("substitutes the USDT pair for a USD-quoted crypto CFD and says so", () => {
    const result = resolveSymbol("BTCUSD");
    expect(result.resolved).toBe("BTCUSDT");
    expect(result.isProxy).toBe(true);
    expect(result.note).toBeTruthy();
  });

  it("maps broker index CFDs to the cash index and flags them as proxies", () => {
    for (const ticker of ["US30", "NAS100", "GER40"]) {
      const result = resolveSymbol(ticker);
      expect(result.assetClass).toBe("index");
      expect(result.isProxy).toBe(true);
      expect(result.note).toContain("CFD");
    }
    expect(resolveSymbol("US30").resolved).toBe("DJI");
    expect(resolveSymbol("NAS100").resolved).toBe("IXIC");
  });

  it("maps gold to spot XAU/USD", () => {
    const result = resolveSymbol("XAUUSD");
    expect(result.resolved).toBe("XAU/USD");
    expect(result.assetClass).toBe("commodity");
    expect(result.isProxy).toBe(true);
  });

  it("strips the account-type suffixes brokers append", () => {
    expect(resolveSymbol("EURUSD.pro").resolved).toBe("EUR/USD");
    expect(resolveSymbol("XAUUSDm").resolved).toBe("XAU/USD");
    expect(resolveSymbol("US30_cash").resolved).toBe("DJI");
  });

  it("treats anything unrecognised as an equity ticker", () => {
    const result = resolveSymbol("AAPL");
    expect(result.provider).toBe("twelvedata");
    expect(result.assetClass).toBe("stock");
    expect(result.resolved).toBe("AAPL");
  });

  it("is case-insensitive", () => {
    expect(resolveSymbol("eurusd").resolved).toBe("EUR/USD");
  });
});
