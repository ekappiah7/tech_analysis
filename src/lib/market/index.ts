import { fetchBinanceCandles } from "./binance";
import { fetchTwelveDataCandles } from "./twelvedata";
import { fetchStooqCandles } from "./stooq";
import { resolveSymbol } from "./symbols";
import type { CandleRequest, CandleResponse } from "./types";

export * from "./types";
export { resolveSymbol } from "./symbols";
export { subscribeBinanceTrades } from "./binance";
export { getTwelveDataKey, setTwelveDataKey } from "./twelvedata";

/**
 * Fetch candles for a symbol written the way the user writes it, routing to
 * whichever free provider actually covers that instrument.
 */
export async function fetchCandles(
  request: CandleRequest,
): Promise<CandleResponse> {
  const resolution = resolveSymbol(request.symbol);
  const warnings: string[] = [];

  if (resolution.isProxy && resolution.note) {
    warnings.push(`${request.symbol} → ${resolution.resolved}. ${resolution.note}`);
  }

  const limit = request.limit ?? 500;
  let candles;

  switch (resolution.provider) {
    case "binance":
      candles = await fetchBinanceCandles(resolution.resolved, request.timeframe, limit);
      break;
    case "twelvedata":
      candles = await fetchTwelveDataCandles(resolution.resolved, request.timeframe, limit);
      break;
    case "stooq":
      candles = await fetchStooqCandles(resolution.resolved, request.timeframe);
      break;
  }

  if (candles.length === 0) {
    warnings.push(`No bars returned for ${resolution.resolved}.`);
  }

  return { candles, resolution, warnings };
}
