import type {
  AuditOptions,
  AuditResult,
  TradeLog,
  Verdict,
} from "@/lib/types";
import { sum } from "./core";
import { bootstrapMean } from "./bootstrap";
import { permutationDrawdown, projectForward } from "./montecarlo";
import { analyseSharpe } from "./sharpe";
import { analyseConcentration } from "./luck";
import { analyseStreaks } from "./streaks";
import { buildBreakdowns } from "./regimes";
import { mulberry32 } from "./random";

/** Fewer trades than this and no test here has the power to conclude anything. */
const MIN_TRADES = 30;

function buildVerdict(
  result: Omit<AuditResult, "verdict">,
  options: Required<Pick<AuditOptions, "trialsTested">>,
): Verdict {
  const reasons: string[] = [];
  const cautions: string[] = [];

  const { n, expectancy, sharpe, concentration, streaks, drawdown } = result;

  if (n < MIN_TRADES) {
    return {
      label: "insufficient-data",
      headline: `${n} trades is not enough to tell skill from luck.`,
      reasons: [
        `With ${n} closed trades, a confidence interval on expectancy is so wide it would contain almost any hypothesis. Nothing below is trustworthy yet.`,
        `Come back at ${MIN_TRADES}+ trades. That is a floor for the tests to run at all, not a threshold that makes results reliable — 100+ is where the numbers start to firm up.`,
      ],
      cautions: [],
    };
  }

  const positiveExpectancy = expectancy.lower > 0;

  if (positiveExpectancy) {
    reasons.push(
      `Expectancy is ${expectancy.estimate.toFixed(2)} per trade, with a 95% confidence interval of ${expectancy.lower.toFixed(2)} to ${expectancy.upper.toFixed(2)}. The interval stays above zero, so the profit is unlikely to be pure chance (p = ${expectancy.pValue.toFixed(4)}).`,
    );
  } else {
    reasons.push(
      `Expectancy is ${expectancy.estimate.toFixed(2)} per trade, but the 95% confidence interval runs from ${expectancy.lower.toFixed(2)} to ${expectancy.upper.toFixed(2)} — it contains zero. A no-edge strategy could produce this record (p = ${expectancy.pValue.toFixed(4)}).`,
    );
  }

  if (options.trialsTested > 1) {
    reasons.push(
      `Adjusted for the ${options.trialsTested} variants you tested, the Deflated Sharpe is ${(sharpe.dsr * 100).toFixed(1)}% (unadjusted: ${(sharpe.psr * 100).toFixed(1)}%). That is the probability the edge survives the fact that you picked the best of several attempts.`,
    );
  }

  if (concentration.fragile) {
    cautions.push(
      `Remove the best 5% of trades and the account goes from ${concentration.totalPnl.toFixed(2)} to ${concentration.pnlExcludingTop5Percent.toFixed(2)}. The record depends on a handful of outliers rather than a repeatable edge.`,
    );
  }

  if (concentration.topTradeShare > 0.25) {
    cautions.push(
      `A single trade accounts for ${(concentration.topTradeShare * 100).toFixed(1)}% of all gross profit. Ask whether that one is repeatable before counting on the rest.`,
    );
  }

  if (streaks.runsPValue < 0.05) {
    cautions.push(
      `Wins and losses are not independent (runs test p = ${streaks.runsPValue.toFixed(4)}). Results cluster, which means the strategy is regime-dependent — and every interval on this page assumes independence, so the true uncertainty is wider than shown.`,
    );
  }

  if (drawdown.observedPercentile < 0.25) {
    cautions.push(
      `Your realised drawdown of ${drawdown.observed.toFixed(2)} sits in the best quartile of possible orderings of these same trades. A median ordering would have given ${drawdown.quantiles.p50.toFixed(2)}, and 1-in-20 orderings reach ${drawdown.quantiles.p95.toFixed(2)}. You have had a kind sequence, not a shallow-drawdown system.`,
    );
  }

  if (sharpe.skew < -0.5 && sharpe.kurtosis > 5) {
    cautions.push(
      `Returns are negatively skewed (${sharpe.skew.toFixed(2)}) with fat tails (kurtosis ${sharpe.kurtosis.toFixed(2)}) — the signature of small consistent wins funding occasional large losses. Sharpe flatters this shape badly.`,
    );
  }

  if (n < 100) {
    cautions.push(
      `${n} trades is above the minimum but still thin. Treat every interval here as provisional.`,
    );
  }

  let label: Verdict["label"];
  let headline: string;

  if (!positiveExpectancy) {
    label = "no-evidence-of-edge";
    headline = "No statistical evidence of an edge.";
  } else if (concentration.fragile || sharpe.dsr < 0.9) {
    label = "weak-evidence";
    headline = "Profitable, but the evidence is fragile.";
  } else {
    label = "edge-supported";
    headline = "The edge holds up statistically.";
  }

  return { label, headline, reasons, cautions };
}

export function auditTradeLog(
  log: TradeLog,
  options: AuditOptions = {},
): AuditResult {
  const trialsTested = options.trialsTested ?? 1;
  const seed = options.seed ?? 20260809;

  const trades = [...log.trades].sort((a, b) => a.closeTime - b.closeTime);
  const pnl = trades.map((t) => t.profit);
  const n = trades.length;

  const span = {
    from: trades.length ? trades[0].openTime : 0,
    to: trades.length ? trades[n - 1].closeTime : 0,
  };

  const expectancy = bootstrapMean(pnl, {
    iterations: options.bootstrapIterations ?? 10_000,
    rng: mulberry32(seed),
  });

  const drawdown = permutationDrawdown(pnl, {
    iterations: options.monteCarloIterations ?? 5_000,
    rng: mulberry32(seed + 1),
  });

  const projection = projectForward(pnl, {
    horizon: options.projectionHorizon ?? Math.max(50, n),
    iterations: options.monteCarloIterations ?? 5_000,
    rng: mulberry32(seed + 2),
  });

  const concentration = analyseConcentration(pnl);
  const grossLoss = concentration.grossLoss;

  let equity = log.initialBalance ?? 0;
  const equityCurve = trades.map((trade) => {
    equity += trade.profit;
    return { t: trade.closeTime, equity };
  });

  const partial = {
    n,
    span,
    netPnl: sum(pnl),
    winRate: n === 0 ? 0 : pnl.filter((x) => x > 0).length / n,
    expectancy,
    profitFactor:
      grossLoss === 0
        ? concentration.grossProfit > 0
          ? Infinity
          : 0
        : concentration.grossProfit / grossLoss,
    sharpe: analyseSharpe(pnl, span, trialsTested),
    drawdown,
    projection,
    concentration,
    streaks: analyseStreaks(pnl),
    breakdowns: buildBreakdowns(trades),
    equityCurve,
  } satisfies Omit<AuditResult, "verdict">;

  return { ...partial, verdict: buildVerdict(partial, { trialsTested }) };
}
