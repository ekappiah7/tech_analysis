import { useCallback, useEffect, useState } from "react";
import {
  fetchCandles,
  getTwelveDataKey,
  setTwelveDataKey,
  type Candle,
  type SymbolResolution,
  type Timeframe,
} from "@/lib/market";
import PriceChart from "@/components/PriceChart";

const TIMEFRAMES: Timeframe[] = ["5m", "15m", "1h", "4h", "1d", "1w"];
const PRESETS = ["BTCUSDT", "ETHUSDT", "EURUSD", "GBPUSD", "XAUUSD", "US30", "NAS100"];

export default function ChartPage() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [input, setInput] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [resolution, setResolution] = useState<SymbolResolution | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(getTwelveDataKey() ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCandles({ symbol, timeframe, limit: 500 });
      setCandles(response.candles);
      setResolution(response.resolution);
      setWarnings(response.warnings);
    } catch (cause) {
      setCandles([]);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSymbol(input.trim().toUpperCase());
          }}
          className="flex items-center gap-2"
        >
          <div>
            <label className="label" htmlFor="symbol">
              Symbol
            </label>
            <input
              id="symbol"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="EURUSD, US30, BTCUSDT…"
              className="mt-1 block w-48 rounded border border-edge bg-ink px-3 py-2 font-mono text-slate-200 outline-none focus:border-slate-500"
            />
          </div>
          <button
            type="submit"
            className="mt-5 rounded bg-edge px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
          >
            Load
          </button>
        </form>

        <div className="flex gap-1">
          {TIMEFRAMES.map((frame) => (
            <button
              key={frame}
              onClick={() => setTimeframe(frame)}
              className={`rounded px-3 py-2 text-sm transition ${
                frame === timeframe
                  ? "bg-edge text-slate-100"
                  : "text-muted hover:text-slate-300"
              }`}
            >
              {frame}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => {
              setInput(preset);
              setSymbol(preset);
            }}
            className={`rounded border px-2.5 py-1 font-mono text-xs transition ${
              preset === symbol
                ? "border-slate-500 text-slate-200"
                : "border-edge text-muted hover:text-slate-300"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      {resolution && (
        <p className="mb-3 text-sm text-muted">
          {resolution.input} →{" "}
          <span className="font-mono text-slate-300">{resolution.resolved}</span>{" "}
          via {resolution.provider} · {resolution.assetClass}
        </p>
      )}

      {warnings.map((warning) => (
        <div
          key={warning}
          className="mb-3 rounded border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn"
        >
          {warning}
        </div>
      ))}

      {error && (
        <div className="mb-3 rounded border border-loss/40 bg-loss/5 px-4 py-3 text-sm text-loss">
          {error}
        </div>
      )}

      <div className="panel overflow-hidden">
        {loading && candles.length === 0 ? (
          <div className="flex h-[460px] items-center justify-center text-sm text-muted">
            Loading {symbol}…
          </div>
        ) : candles.length > 0 ? (
          <PriceChart candles={candles} />
        ) : (
          <div className="flex h-[460px] items-center justify-center text-sm text-muted">
            No data.
          </div>
        )}
      </div>

      <section className="panel mt-6">
        <h3 className="panel-heading">Data sources</h3>
        <div className="space-y-4 p-5 text-sm">
          <p className="text-muted">
            Crypto comes from Binance — no key, no signup, real-time. Forex,
            equities, indices and commodities come from Twelve Data, which needs
            a free key (800 requests/day, 8 per minute).
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label" htmlFor="apikey">
                Twelve Data API key
              </label>
              <input
                id="apikey"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="paste your free key"
                className="mt-1 block w-72 rounded border border-edge bg-ink px-3 py-2 font-mono text-slate-200 outline-none focus:border-slate-500"
              />
            </div>
            <button
              onClick={() => {
                setTwelveDataKey(apiKey);
                void load();
              }}
              className="rounded bg-edge px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
            >
              Save
            </button>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Stored in this browser only. Broker CFDs like US30 and XAUUSD have no
            free public feed, so they are charted against the underlying cash
            index or spot price — close in shape, never equal to your fills.
          </p>
        </div>
      </section>
    </div>
  );
}
