import { useCallback, useState } from "react";
import { parseTradeFile } from "@/lib/parsers";
import { auditTradeLog } from "@/lib/stats/audit";
import type { AuditResult, TradeLog } from "@/lib/types";
import FileDrop from "@/components/FileDrop";
import AuditReport from "@/components/AuditReport";

export default function AuditPage() {
  const [log, setLog] = useState<TradeLog | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [trialsTested, setTrialsTested] = useState(1);
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState<string>("");

  const run = useCallback((source: TradeLog, trials: number) => {
    setBusy(true);
    // Yield a frame so the busy state paints before the simulations block the
    // thread. Ten thousand bootstrap resamples is fast but not instant.
    setTimeout(() => {
      setResult(auditTradeLog(source, { trialsTested: trials }));
      setBusy(false);
    }, 0);
  }, []);

  const handleFile = useCallback(
    (text: string, name: string) => {
      setBusy(true);
      setFilename(name);
      const parsed = parseTradeFile(text, name);
      setLog(parsed);
      if (parsed.trades.length === 0) {
        setResult(null);
        setBusy(false);
        return;
      }
      run(parsed, trialsTested);
    },
    [run, trialsTested],
  );

  const loadSample = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/sample-mt4-statement.htm");
      handleFile(await response.text(), "sample-mt4-statement.htm");
    } catch {
      setBusy(false);
    }
  }, [handleFile]);

  const reset = () => {
    setLog(null);
    setResult(null);
    setFilename("");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {!result && (
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-semibold text-slate-100">
            Is your edge real, or have you been lucky?
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Import a trade history and get the statistics a backtest report never
            shows you: a confidence interval on your expectancy, the drawdown you
            should have expected, and an honest answer on whether the record
            could have come from no edge at all.
          </p>

          <div className="mt-8">
            <FileDrop onFile={handleFile} busy={busy} />
          </div>

          <p className="mt-3 text-sm text-muted">
            No statement to hand?{" "}
            <button
              onClick={() => void loadSample()}
              className="text-slate-300 underline underline-offset-4 transition hover:text-slate-100"
            >
              Audit a sample account
            </button>{" "}
            — 214 trades, 74% of them winners, up $611. See what the statistics
            make of it.
          </p>

          <div className="mt-6 panel p-5">
            <label className="label" htmlFor="trials">
              How many strategy variants did you test before choosing this one?
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="trials"
                type="number"
                min={1}
                max={100000}
                value={trialsTested}
                onChange={(event) =>
                  setTrialsTested(Math.max(1, Number(event.target.value) || 1))
                }
                className="tabular w-28 rounded border border-edge bg-ink px-3 py-2 text-slate-200 outline-none focus:border-slate-500"
              />
              <p className="text-xs leading-relaxed text-muted">
                Every parameter set, indicator combination or timeframe you tried
                and discarded counts. Testing many and keeping the best is a
                selection process, and the Deflated Sharpe corrects for it. Be
                honest — this is the single biggest lever on the result.
              </p>
            </div>
          </div>

          {log && log.trades.length === 0 && (
            <div className="mt-6 rounded border border-loss/40 bg-loss/5 p-5">
              <p className="text-sm font-medium text-loss">
                Nothing could be read from {filename || "that file"}.
              </p>
              <ul className="mt-2 space-y-1">
                {log.warnings.map((warning) => (
                  <li key={warning} className="text-sm text-muted">
                    — {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-6 text-xs leading-relaxed text-muted">
            Your file is read in the browser and never uploaded anywhere.
          </p>
        </div>
      )}

      {result && log && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-100">
                Audit — {filename}
              </h1>
              <p className="text-sm text-muted">Read as {log.source}</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="label" htmlFor="trials-live">
                Variants tested
              </label>
              <input
                id="trials-live"
                type="number"
                min={1}
                value={trialsTested}
                onChange={(event) => {
                  const next = Math.max(1, Number(event.target.value) || 1);
                  setTrialsTested(next);
                  run(log, next);
                }}
                className="tabular w-24 rounded border border-edge bg-ink px-3 py-1.5 text-slate-200 outline-none focus:border-slate-500"
              />
              <button
                onClick={reset}
                className="rounded border border-edge px-3 py-1.5 text-sm text-muted transition hover:text-slate-200"
              >
                New file
              </button>
            </div>
          </div>

          <AuditReport result={result} log={log} />
        </>
      )}
    </div>
  );
}
