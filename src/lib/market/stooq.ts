import { parseCsv, parseNumber } from "@/lib/parsers/csv";
import type { Candle, Timeframe } from "./types";
import { requestJson } from "./http";

const INTERVALS: Partial<Record<Timeframe, string>> = {
  "1d": "d",
  "1w": "w",
};

/**
 * Stooq end-of-day history — keyless, deep, and covering FX, indices and equities.
 *
 * One caveat that decides how this can be used: Stooq sends no CORS headers, so
 * a browser fetch is blocked no matter what the URL is. It is reachable only
 * through a proxy you control. `VITE_STOOQ_PROXY` should point at one; without
 * it this adapter fails loudly rather than appearing to work and returning
 * nothing.
 */
export function getStooqProxy(): string | null {
  const configured = import.meta.env?.VITE_STOOQ_PROXY as string | undefined;
  return configured && configured.trim() ? configured.replace(/\/$/, "") : null;
}

export async function fetchStooqCandles(
  symbol: string,
  timeframe: Timeframe,
): Promise<Candle[]> {
  const interval = INTERVALS[timeframe];
  if (!interval) {
    throw new Error(
      "Stooq only publishes daily and weekly bars. Use Binance or Twelve Data for intraday.",
    );
  }

  const proxy = getStooqProxy();
  if (!proxy) {
    throw new Error(
      "Stooq blocks direct browser requests (no CORS headers). Set VITE_STOOQ_PROXY to a proxy you control to enable this source.",
    );
  }

  const target = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}&i=${interval}`;
  const response = await requestJson(
    `${proxy}?url=${encodeURIComponent(target)}`,
    "the Stooq proxy",
  );
  if (!response.ok) {
    throw new Error(`Stooq proxy returned ${response.status} for ${symbol}.`);
  }

  const rows = parseCsv(await response.text());
  if (rows.length < 2) {
    throw new Error(`Stooq has no data for "${symbol}".`);
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name);
  const dateIndex = col("date");
  if (dateIndex < 0) throw new Error("Unexpected Stooq response format.");

  return rows
    .slice(1)
    .map((row) => ({
      time: Math.floor(Date.parse(`${row[dateIndex]}T00:00:00Z`) / 1000),
      open: parseNumber(row[col("open")]),
      high: parseNumber(row[col("high")]),
      low: parseNumber(row[col("low")]),
      close: parseNumber(row[col("close")]),
      volume: parseNumber(row[col("volume")]) || 0,
    }))
    .filter((candle) => Number.isFinite(candle.time) && Number.isFinite(candle.close))
    .sort((a, b) => a.time - b.time);
}
