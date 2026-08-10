import type { Candle, Timeframe } from "./types";
import { requestJson } from "./http";

const BASE = "https://api.twelvedata.com";
const STORAGE_KEY = "ta.twelvedata.key";

const INTERVALS: Record<Timeframe, string> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
  "1w": "1week",
};

/**
 * The free Twelve Data key, from the build environment or from whatever the user
 * pasted into settings. Kept in localStorage rather than a server: this is a
 * two-person tool and a free-tier market-data key is not worth a backend.
 */
export function getTwelveDataKey(): string | null {
  const fromEnv = import.meta.env?.VITE_TWELVEDATA_API_KEY as string | undefined;
  if (fromEnv) return fromEnv;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setTwelveDataKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing with storage disabled — the key just won't persist.
  }
}

interface TimeSeriesValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

/**
 * Twelve Data time series — forex, equities, indices and commodities from one
 * endpoint. Free tier allows 800 requests/day and 8/minute, which is ample for
 * two people and nowhere near enough for a public app.
 */
export async function fetchTwelveDataCandles(
  symbol: string,
  timeframe: Timeframe,
  limit = 500,
): Promise<Candle[]> {
  const key = getTwelveDataKey();
  if (!key) {
    throw new Error(
      "No Twelve Data API key set. Get a free one at twelvedata.com and add it in Settings — crypto works without a key, everything else needs one.",
    );
  }

  const url = new URL(`${BASE}/time_series`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", INTERVALS[timeframe]);
  url.searchParams.set("outputsize", String(Math.min(limit, 5000)));
  url.searchParams.set("format", "JSON");
  url.searchParams.set("apikey", key);

  const response = await requestJson(url, "Twelve Data");
  const payload = (await response.json()) as {
    status?: string;
    message?: string;
    code?: number;
    values?: TimeSeriesValue[];
  };

  // Twelve Data reports errors in the body with HTTP 200, so the status code
  // alone is not enough to know whether the call worked.
  if (payload.status === "error" || !payload.values) {
    const message = payload.message ?? "Unknown error";
    if (payload.code === 429 || /limit/i.test(message)) {
      throw new Error(
        `Twelve Data rate limit reached (8 requests/minute, 800/day on the free tier). ${message}`,
      );
    }
    throw new Error(`Twelve Data could not return ${symbol}: ${message}`);
  }

  // Values arrive newest-first; charts need oldest-first.
  return payload.values
    .map((value) => ({
      time: Math.floor(Date.parse(`${value.datetime.replace(" ", "T")}Z`) / 1000),
      open: Number(value.open),
      high: Number(value.high),
      low: Number(value.low),
      close: Number(value.close),
      volume: value.volume ? Number(value.volume) : 0,
    }))
    .filter((candle) => Number.isFinite(candle.time))
    .sort((a, b) => a.time - b.time);
}
