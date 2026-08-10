import type { Candle, Timeframe } from "./types";
import { requestJson } from "./http";

const BASE = "https://api.binance.com/api/v3";

const INTERVALS: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
};

/**
 * Binance spot klines. No API key, no signup, CORS-enabled, and the raw limit is
 * 1000 bars per call — the best free market data available to a browser app.
 *
 * Kline tuples arrive as
 * [openTime, open, high, low, close, volume, closeTime, ...] with every price
 * as a string.
 */
export async function fetchBinanceCandles(
  symbol: string,
  timeframe: Timeframe,
  limit = 500,
): Promise<Candle[]> {
  const url = new URL(`${BASE}/klines`);
  url.searchParams.set("symbol", symbol.toUpperCase());
  url.searchParams.set("interval", INTERVALS[timeframe]);
  url.searchParams.set("limit", String(Math.min(limit, 1000)));

  const response = await requestJson(url, "Binance");
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Binance rejected the request for ${symbol} (${response.status}). ${detail.slice(0, 160)}`,
    );
  }

  const rows = (await response.json()) as unknown[];
  if (!Array.isArray(rows)) throw new Error("Unexpected response from Binance.");

  return rows.map((row) => {
    const k = row as [number, string, string, string, string, string];
    return {
      time: Math.floor(k[0] / 1000),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    };
  });
}

/** Live trade stream. Returns a disposer; callers must call it on unmount. */
export function subscribeBinanceTrades(
  symbol: string,
  onPrice: (price: number, timeMs: number) => void,
): () => void {
  const stream = `${symbol.toLowerCase()}@trade`;
  const socket = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data as string) as { p?: string; T?: number };
      if (payload.p) onPrice(Number(payload.p), payload.T ?? Date.now());
    } catch {
      // A malformed frame is not worth tearing the stream down for.
    }
  };

  return () => {
    socket.onmessage = null;
    if (socket.readyState <= WebSocket.OPEN) socket.close();
  };
}
