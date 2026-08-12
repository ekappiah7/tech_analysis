import type { Trade } from "./types";

/**
 * Shift trade timestamps from broker server time to UTC.
 *
 * MetaTrader statements carry the broker's server clock, which is typically
 * UTC+2 or UTC+3 and shifts with European daylight saving. Left uncorrected,
 * every session and day-of-week breakdown is displaced by that offset — enough
 * to move trades out of the London window entirely and make the breakdown
 * actively misleading rather than merely imprecise.
 *
 * `offsetHours` is the broker's offset from UTC, so a UTC+3 server takes 3.
 */
export function shiftToUtc(trades: Trade[], offsetHours: number): Trade[] {
  if (!Number.isFinite(offsetHours) || offsetHours === 0) return trades;
  const deltaMs = offsetHours * 3_600_000;
  return trades.map((trade) => ({
    ...trade,
    openTime: trade.openTime - deltaMs,
    closeTime: trade.closeTime - deltaMs,
  }));
}
