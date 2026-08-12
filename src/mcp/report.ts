import type { AuditResult, TradeLog } from "@/lib/types";

function money(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(2);
}

function percent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(digits)}%`;
}

function pValue(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return value < 0.0001 ? "<0.0001" : value.toFixed(4);
}

function isoDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp === 0) return "n/a";
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * Plain-language guardrails on what each verdict does and does not license.
 *
 * A language model reading "expectancy +2.85 per trade" will report the account
 * as profitable unless told otherwise, which would defeat the entire purpose of
 * running the test. The interpretation is therefore stated for the model rather
 * than left to be inferred from the numbers.
 */
const INTERPRETATION: Record<AuditResult["verdict"]["label"], string> = {
  "insufficient-data":
    "Do not draw any conclusion about this strategy's edge, in either direction. The sample is too small for the tests to have power. Saying 'it looks promising' here is not supported.",
  "no-evidence-of-edge":
    "The record is consistent with a strategy that has no edge at all. This is NOT the same as proving the strategy is bad, but it does mean a positive net P&L here is not evidence of skill, and must not be reported as though it were.",
  "weak-evidence":
    "There is some statistical support for an edge, but it depends on fragile assumptions — outlier trades, or a selection process that has not been fully corrected for. Report the caveats alongside any positive statement.",
  "edge-supported":
    "The edge survives the tests applied. This still assumes future conditions resemble past ones, and says nothing about whether the strategy will keep working.",
};

/** Render an audit as markdown for a language model to read and relay. */
export function formatAuditReport(
  result: AuditResult,
  log: TradeLog,
  source: string,
): string {
  const { verdict, expectancy, sharpe, concentration, streaks, drawdown, projection } =
    result;

  const lines: string[] = [];

  lines.push(`# Strategy audit — ${source}`);
  lines.push("");
  lines.push(`**Verdict: ${verdict.headline}**`);
  lines.push("");
  lines.push(`How to interpret this: ${INTERPRETATION[verdict.label]}`);
  lines.push("");

  lines.push("## Findings");
  for (const reason of verdict.reasons) lines.push(`- ${reason}`);

  if (verdict.cautions.length > 0) {
    lines.push("");
    lines.push("## Cautions");
    for (const caution of verdict.cautions) lines.push(`- ${caution}`);
  }

  lines.push("");
  lines.push("## Headline figures");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Trades | ${result.n} |`);
  lines.push(`| Period | ${isoDate(result.span.from)} to ${isoDate(result.span.to)} |`);
  lines.push(`| Net P&L | ${money(result.netPnl)} |`);
  lines.push(`| Win rate | ${percent(result.winRate)} |`);
  lines.push(`| Profit factor | ${money(result.profitFactor)} |`);
  lines.push(
    `| Expectancy per trade | ${money(expectancy.estimate)} (95% CI ${money(expectancy.lower)} to ${money(expectancy.upper)}) |`,
  );
  lines.push(`| p-value, edge ≠ 0 | ${pValue(expectancy.pValue)} |`);
  lines.push(`| Sharpe (annualised) | ${money(sharpe.annualised)} |`);
  lines.push(`| Probabilistic Sharpe | ${percent(sharpe.psr, 0)} |`);
  lines.push(
    `| Deflated Sharpe (${sharpe.trialsTested} variant${sharpe.trialsTested === 1 ? "" : "s"} tested) | ${percent(sharpe.dsr, 0)} |`,
  );
  lines.push(`| Return skew / kurtosis | ${sharpe.skew.toFixed(2)} / ${sharpe.kurtosis.toFixed(2)} |`);

  lines.push("");
  lines.push("## Drawdown");
  lines.push("");
  lines.push(
    `Realised max drawdown was ${money(drawdown.observed)}. Across ${drawdown.iterations.toLocaleString()} random re-orderings of the same trades, the median was ${money(drawdown.quantiles.p50)}, the 90th percentile ${money(drawdown.quantiles.p90)} and the 99th ${money(drawdown.quantiles.p99)}. The realised figure sits at the ${percent(drawdown.observedPercentile, 0)} mark of that distribution.`,
  );
  lines.push("");
  lines.push(
    `Reordering cannot change the final balance — currency P&L is additive — so this measures path luck only, not the size of the edge.`,
  );

  lines.push("");
  lines.push(`## Projection over the next ${projection.horizon} trades`);
  lines.push("");
  lines.push(
    `Resampling with replacement from the realised distribution: median outcome ${money(projection.finalPnl.p50)}, 5th percentile ${money(projection.finalPnl.p05)}, 95th percentile ${money(projection.finalPnl.p95)}. Probability of ending down: ${percent(projection.probabilityOfLoss, 0)}. A 1-in-20 drawdown over that horizon is ${money(projection.maxDrawdown.p95)}.`,
  );
  lines.push("");
  lines.push(
    "This assumes future trades are independent draws from the same distribution. Both assumptions are optimistic, so treat the low end as the more informative tail.",
  );

  lines.push("");
  lines.push("## Concentration");
  lines.push("");
  lines.push(
    `The single best trade is ${percent(concentration.topTradeShare)} of gross profit; the best 5% of trades are ${percent(concentration.top5PercentShare)}. Net P&L excluding the best trade: ${money(concentration.pnlExcludingTop1)}. Excluding the best 5%: ${money(concentration.pnlExcludingTop5Percent)}.${concentration.fragile ? " Stripping the best 5% turns the account negative — the record rests on outliers." : ""}`,
  );

  lines.push("");
  lines.push("## Streaks and independence");
  lines.push("");
  lines.push(
    `Longest winning run ${streaks.longestWin} (expected ≈ ${streaks.expectedLongestWin.toFixed(1)}); longest losing run ${streaks.longestLoss} (expected ≈ ${streaks.expectedLongestLoss.toFixed(1)}). Wald–Wolfowitz runs test p = ${pValue(streaks.runsPValue)}.${
      streaks.runsPValue < 0.05
        ? " Wins and losses are NOT independent — results cluster, so the strategy is regime-dependent and every interval above understates the true uncertainty."
        : " Consistent with independent ordering."
    }`,
  );

  lines.push("");
  lines.push("## Breakdowns");
  lines.push("");
  lines.push(
    "q-values are Benjamini–Hochberg adjusted within each breakdown. Only q is meaningful: raw p-values across five slices of one record will always throw up something that looks significant. Buckets under 30 trades are marked underpowered and should not be acted on.",
  );

  for (const breakdown of result.breakdowns) {
    lines.push("");
    lines.push(`### ${breakdown.name}`);
    lines.push("");
    lines.push("| Bucket | n | Win rate | Per trade | Total | p | q | Verdict |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const bucket of breakdown.buckets) {
      const flag = bucket.significant
        ? "holds up"
        : bucket.underpowered
          ? "underpowered"
          : "not significant";
      lines.push(
        `| ${bucket.key} | ${bucket.n} | ${percent(bucket.winRate, 0)} | ${money(bucket.expectancy)} | ${money(bucket.totalPnl)} | ${pValue(bucket.pValue)} | ${pValue(bucket.qValue)} | ${flag} |`,
      );
    }
  }

  if (log.warnings.length > 0) {
    lines.push("");
    lines.push("## Notes on the source data");
    for (const warning of log.warnings) lines.push(`- ${warning}`);
  }

  return lines.join("\n");
}
