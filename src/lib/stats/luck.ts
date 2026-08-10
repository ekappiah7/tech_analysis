import type { ConcentrationResult } from "@/lib/types";
import { sum } from "./core";

/**
 * How much of the account is resting on a handful of trades.
 *
 * A track record where two trades carry the whole P&L is not a strategy with an
 * edge, it is a strategy with two lucky trades. This is the cheapest and most
 * reliable tell for a curve-fit system, and almost no retail reporting shows it.
 */
export function analyseConcentration(pnl: number[]): ConcentrationResult {
  const totalPnl = sum(pnl);
  const wins = pnl.filter((x) => x > 0);
  const losses = pnl.filter((x) => x < 0);
  const grossProfit = sum(wins);
  const grossLoss = Math.abs(sum(losses));

  if (pnl.length === 0) {
    return {
      totalPnl: 0,
      grossProfit: 0,
      grossLoss: 0,
      topTradeShare: 0,
      top5PercentShare: 0,
      pnlExcludingTop1: 0,
      pnlExcludingTop5Percent: 0,
      fragile: false,
    };
  }

  const descending = [...pnl].sort((a, b) => b - a);
  const topCount = Math.max(1, Math.round(pnl.length * 0.05));
  const top1 = descending[0];
  const top5Percent = sum(descending.slice(0, topCount));

  const pnlExcludingTop1 = totalPnl - top1;
  const pnlExcludingTop5Percent = totalPnl - top5Percent;

  return {
    totalPnl,
    grossProfit,
    grossLoss,
    topTradeShare: grossProfit > 0 ? top1 / grossProfit : 0,
    top5PercentShare: grossProfit > 0 ? top5Percent / grossProfit : 0,
    pnlExcludingTop1,
    pnlExcludingTop5Percent,
    fragile: totalPnl > 0 && pnlExcludingTop5Percent <= 0,
  };
}
