export type Direction = "long" | "short";

export type SourceFormat =
  | "mt4-html"
  | "mt5-html"
  | "tradingview-csv"
  | "generic-csv"
  | "unknown";

/**
 * One closed round-trip trade, normalised across every broker format we read.
 *
 * `profit` is always NET of commission and swap, in account currency. Brokers
 * disagree about whether their headline "Profit" column already includes those,
 * so each parser is responsible for resolving that and populating `grossProfit`
 * separately. Downstream statistics only ever look at `profit`.
 */
export interface Trade {
  id: string;
  symbol: string;
  direction: Direction;
  openTime: number;
  closeTime: number;
  openPrice: number;
  closePrice: number;
  volume: number;
  profit: number;
  grossProfit: number;
  commission: number;
  swap: number;
  comment?: string;
}

export interface TradeLog {
  source: SourceFormat;
  trades: Trade[];
  accountCurrency?: string;
  accountId?: string;
  initialBalance?: number;
  /** Non-fatal problems worth showing the user rather than swallowing. */
  warnings: string[];
}

export interface Interval {
  lower: number;
  upper: number;
}

export interface BootstrapResult {
  estimate: number;
  lower: number;
  upper: number;
  /** Two-sided bootstrap percentile p-value against a null of zero. */
  pValue: number;
  iterations: number;
}

export interface DrawdownDistribution {
  /** Max drawdown of the trades in the order they were actually taken. */
  observed: number;
  /** Quantiles of max drawdown across random re-orderings of the same trades. */
  quantiles: Record<"p50" | "p75" | "p90" | "p95" | "p99", number>;
  /** Where the realised drawdown sits in that distribution, in [0, 1]. */
  observedPercentile: number;
  iterations: number;
}

export interface ForwardProjection {
  horizon: number;
  finalPnl: Record<"p05" | "p25" | "p50" | "p75" | "p95", number>;
  maxDrawdown: Record<"p50" | "p90" | "p95" | "p99", number>;
  probabilityOfLoss: number;
  iterations: number;
}

export interface SharpeResult {
  perTrade: number;
  annualised: number;
  tradesPerYear: number;
  skew: number;
  kurtosis: number;
  /** Probabilistic Sharpe Ratio against a zero benchmark. */
  psr: number;
  /** Deflated Sharpe Ratio, correcting for the number of variants tried. */
  dsr: number;
  trialsTested: number;
}

export interface ConcentrationResult {
  totalPnl: number;
  grossProfit: number;
  grossLoss: number;
  topTradeShare: number;
  top5PercentShare: number;
  pnlExcludingTop1: number;
  pnlExcludingTop5Percent: number;
  /** True when stripping the best 5% of trades turns the account negative. */
  fragile: boolean;
}

export interface StreakResult {
  longestWin: number;
  longestLoss: number;
  expectedLongestWin: number;
  expectedLongestLoss: number;
  /** Wald–Wolfowitz runs test on the win/loss sequence. */
  runs: number;
  expectedRuns: number;
  runsZ: number;
  runsPValue: number;
}

export interface BucketStats {
  key: string;
  n: number;
  winRate: number;
  expectancy: number;
  totalPnl: number;
  pValue: number;
  /** Benjamini–Hochberg adjusted p-value across the buckets in this breakdown. */
  qValue: number;
  significant: boolean;
  underpowered: boolean;
}

export interface Breakdown {
  name: string;
  buckets: BucketStats[];
}

export type VerdictLabel =
  | "insufficient-data"
  | "no-evidence-of-edge"
  | "weak-evidence"
  | "edge-supported";

export interface Verdict {
  label: VerdictLabel;
  headline: string;
  reasons: string[];
  cautions: string[];
}

export interface AuditResult {
  n: number;
  span: { from: number; to: number };
  netPnl: number;
  winRate: number;
  expectancy: BootstrapResult;
  profitFactor: number;
  sharpe: SharpeResult;
  drawdown: DrawdownDistribution;
  projection: ForwardProjection;
  concentration: ConcentrationResult;
  streaks: StreakResult;
  breakdowns: Breakdown[];
  equityCurve: { t: number; equity: number }[];
  verdict: Verdict;
}

export interface AuditOptions {
  /**
   * How many strategy variants were tested before settling on this one. Drives
   * the Deflated Sharpe correction — be honest here, it is the single biggest
   * lever on whether a backtest survives scrutiny.
   */
  trialsTested?: number;
  bootstrapIterations?: number;
  monteCarloIterations?: number;
  /** Number of future trades to project in the forward simulation. */
  projectionHorizon?: number;
  seed?: number;
}
