import { describe, expect, it } from "vitest";
import { shiftToUtc } from "./timezone";
import { sessionOf } from "./stats/regimes";
import type { Trade } from "./types";

function trade(openUtc: number): Trade {
  return {
    id: "1",
    symbol: "EURUSD",
    direction: "long",
    openTime: openUtc,
    closeTime: openUtc + 3_600_000,
    openPrice: 1,
    closePrice: 1,
    volume: 0.1,
    profit: 10,
    grossProfit: 10,
    commission: 0,
    swap: 0,
  };
}

describe("broker server time correction", () => {
  it("subtracts the broker's offset from UTC", () => {
    const stamped = Date.UTC(2026, 0, 5, 10, 0, 0);
    const [shifted] = shiftToUtc([trade(stamped)], 3);
    expect(shifted.openTime).toBe(Date.UTC(2026, 0, 5, 7, 0, 0));
    expect(shifted.closeTime).toBe(Date.UTC(2026, 0, 5, 8, 0, 0));
  });

  it("returns the input untouched for a zero or invalid offset", () => {
    const input = [trade(Date.UTC(2026, 0, 5, 10, 0, 0))];
    expect(shiftToUtc(input, 0)).toBe(input);
    expect(shiftToUtc(input, Number.NaN)).toBe(input);
  });

  it("moves a trade into the correct session, which is the whole point", () => {
    // 09:30 on a UTC+3 broker clock is 06:30 UTC — Asia, not London. Left
    // uncorrected the session breakdown attributes it to the wrong window.
    const brokerStamped = Date.UTC(2026, 0, 5, 9, 30, 0);
    expect(sessionOf(brokerStamped)).toBe("London (07–12 UTC)");

    const [corrected] = shiftToUtc([trade(brokerStamped)], 3);
    expect(sessionOf(corrected.openTime)).toBe("Asia (00–07 UTC)");
  });

  it("does not mutate the trades passed in", () => {
    const original = trade(Date.UTC(2026, 0, 5, 10, 0, 0));
    const openBefore = original.openTime;
    shiftToUtc([original], 2);
    expect(original.openTime).toBe(openBefore);
  });
});
