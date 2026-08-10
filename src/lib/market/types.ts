export interface Candle {
  /** Bar open time, epoch seconds (what Lightweight Charts expects). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

export type AssetClass = "crypto" | "forex" | "stock" | "index" | "commodity";

export interface SymbolResolution {
  /** The symbol as the broker/user wrote it, e.g. "US30" or "XAUUSD". */
  input: string;
  /** The symbol actually queried on the provider. */
  resolved: string;
  provider: "binance" | "twelvedata" | "stooq";
  assetClass: AssetClass;
  /**
   * True when the resolved symbol is only an approximation of the instrument
   * traded — a cash index standing in for a broker CFD, or spot gold for a
   * futures-based contract. Prices will not match your fills.
   */
  isProxy: boolean;
  note?: string;
}

export interface CandleRequest {
  symbol: string;
  timeframe: Timeframe;
  limit?: number;
}

export interface CandleResponse {
  candles: Candle[];
  resolution: SymbolResolution;
  warnings: string[];
}
