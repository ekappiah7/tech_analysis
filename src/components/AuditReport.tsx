import type { AuditResult, TradeLog, VerdictLabel } from "@/lib/types";
import {
  duration,
  money,
  percent,
  pValue,
  ratio,
  shortDate,
  signedMoney,
} from "@/lib/format";
import EquityChart from "./EquityChart";
import DrawdownPanel from "./DrawdownPanel";
import BreakdownTables from "./BreakdownTables";

interface Props {
  result: AuditResult;
  log: TradeLog;
}

const VERDICT_STYLES: Record<VerdictLabel, { border: string; text: string; chip: string }> = {
  "insufficient-data": {
    border: "border-slate-600",
    text: "text-slate-300",
    chip: "bg-slate-700 text-slate-200",
  },
  "no-evidence-of-edge": {
    border: "border-loss",
    text: "text-loss",
    chip: "bg-loss/20 text-loss",
  },
  "weak-evidence": {
    border: "border-warn",
    text: "text-warn",
    chip: "bg-warn/20 text-warn",
  },
  "edge-supported": {
    border: "border-win",
    text: "text-win",
    chip: "bg-win/20 text-win",
  },
};

const VERDICT_CHIPS: Record<VerdictLabel, string> = {
  "insufficient-data": "Not enough data",
  "no-evidence-of-edge": "No evidence of edge",
  "weak-evidence": "Weak evidence",
  "edge-supported": "Edge supported",
};

function Stat({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "bad";
  hint?: string;
}) {
  const toneClass =
    tone === "good" ? "text-win" : tone === "bad" ? "text-loss" : "text-slate-100";
  return (
    <div className="panel px-4 py-3">
      <p className="label">{label}</p>
      <p className={`tabular mt-1 text-lg ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function AuditReport({ result, log }: Props) {
  const style = VERDICT_STYLES[result.verdict.label];
  const { expectancy, sharpe, concentration, streaks } = result;

  return (
    <div className="space-y-6">
      <section className={`panel border-l-4 ${style.border}`}>
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide ${style.chip}`}
            >
              {VERDICT_CHIPS[result.verdict.label]}
            </span>
            <span className="text-sm text-muted">
              {result.n} trades · {shortDate(result.span.from)} to{" "}
              {shortDate(result.span.to)} ·{" "}
              {duration(result.span.from, result.span.to)}
            </span>
          </div>

          <h2 className={`mt-3 text-2xl font-semibold ${style.text}`}>
            {result.verdict.headline}
          </h2>

          <ul className="mt-4 space-y-2">
            {result.verdict.reasons.map((reason) => (
              <li key={reason} className="text-sm leading-relaxed text-slate-300">
                {reason}
              </li>
            ))}
          </ul>

          {result.verdict.cautions.length > 0 && (
            <div className="mt-5 rounded border border-warn/30 bg-warn/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-warn">
                Read this before you size up
              </p>
              <ul className="mt-2 space-y-2">
                {result.verdict.cautions.map((caution) => (
                  <li key={caution} className="text-sm leading-relaxed text-slate-300">
                    {caution}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Net P&L"
          value={signedMoney(result.netPnl)}
          tone={result.netPnl >= 0 ? "good" : "bad"}
        />
        <Stat
          label="Expectancy / trade"
          value={signedMoney(expectancy.estimate)}
          tone={expectancy.lower > 0 ? "good" : "neutral"}
          hint={`95% CI ${money(expectancy.lower)} to ${money(expectancy.upper)}`}
        />
        <Stat label="Win rate" value={percent(result.winRate)} />
        <Stat
          label="Profit factor"
          value={ratio(result.profitFactor)}
          tone={result.profitFactor >= 1 ? "good" : "bad"}
        />
        <Stat
          label="p-value (edge ≠ 0)"
          value={pValue(expectancy.pValue)}
          hint="Chance a no-edge strategy produces this"
        />
        <Stat
          label="Sharpe (annualised)"
          value={ratio(sharpe.annualised)}
          hint={`${Math.round(sharpe.tradesPerYear)} trades/year`}
        />
        <Stat
          label={sharpe.trialsTested > 1 ? "Deflated Sharpe" : "Probabilistic Sharpe"}
          value={percent(sharpe.trialsTested > 1 ? sharpe.dsr : sharpe.psr, 0)}
          tone={
            (sharpe.trialsTested > 1 ? sharpe.dsr : sharpe.psr) > 0.95
              ? "good"
              : "neutral"
          }
          hint={
            sharpe.trialsTested > 1
              ? `Adjusted for ${sharpe.trialsTested} variants tried`
              : "Confidence the true Sharpe beats zero"
          }
        />
        <Stat
          label="Max drawdown"
          value={money(result.drawdown.observed)}
          tone="bad"
          hint={`Typical for these trades: ${money(result.drawdown.quantiles.p50)}`}
        />
      </div>

      <section className="panel">
        <h3 className="panel-heading">Equity curve</h3>
        <div className="p-5">
          <EquityChart points={result.equityCurve} />
        </div>
      </section>

      <DrawdownPanel drawdown={result.drawdown} projection={result.projection} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <h3 className="panel-heading">How much rests on your best trades</h3>
          <dl className="space-y-3 p-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Biggest single winner, as a share of gross profit</dt>
              <dd className="tabular text-slate-200">
                {percent(concentration.topTradeShare)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Top 5% of trades, as a share of gross profit</dt>
              <dd className="tabular text-slate-200">
                {percent(concentration.top5PercentShare)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-edge pt-3">
              <dt className="text-muted">Net P&L without your single best trade</dt>
              <dd
                className={`tabular ${concentration.pnlExcludingTop1 >= 0 ? "text-win" : "text-loss"}`}
              >
                {signedMoney(concentration.pnlExcludingTop1)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Net P&L without your best 5%</dt>
              <dd
                className={`tabular ${concentration.pnlExcludingTop5Percent >= 0 ? "text-win" : "text-loss"}`}
              >
                {signedMoney(concentration.pnlExcludingTop5Percent)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h3 className="panel-heading">Streaks and independence</h3>
          <dl className="space-y-3 p-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Longest winning run</dt>
              <dd className="tabular text-slate-200">
                {streaks.longestWin}{" "}
                <span className="text-muted">
                  (expected ≈ {streaks.expectedLongestWin.toFixed(1)})
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Longest losing run</dt>
              <dd className="tabular text-slate-200">
                {streaks.longestLoss}{" "}
                <span className="text-muted">
                  (expected ≈ {streaks.expectedLongestLoss.toFixed(1)})
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-edge pt-3">
              <dt className="text-muted">Runs test p-value</dt>
              <dd
                className={`tabular ${streaks.runsPValue < 0.05 ? "text-warn" : "text-slate-200"}`}
              >
                {pValue(streaks.runsPValue)}
              </dd>
            </div>
            <p className="pt-1 text-xs leading-relaxed text-muted">
              {streaks.runsPValue < 0.05
                ? "Wins and losses cluster rather than alternating randomly. The strategy depends on market state, and every confidence interval above is narrower than reality."
                : "Wins and losses are ordered about as randomly as independence predicts. A long losing run of this length was always on the cards — it is not proof anything broke."}
            </p>
          </dl>
        </section>
      </div>

      <BreakdownTables breakdowns={result.breakdowns} />

      {log.warnings.length > 0 && (
        <section className="panel">
          <h3 className="panel-heading">Notes on how your file was read</h3>
          <ul className="space-y-2 p-5">
            {log.warnings.map((warning) => (
              <li key={warning} className="text-sm leading-relaxed text-muted">
                — {warning}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
