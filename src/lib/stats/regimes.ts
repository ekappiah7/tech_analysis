import type { Breakdown, BucketStats, Trade } from "@/lib/types";
import { benjaminiHochberg, mean, sum, tTestAgainstZero } from "./core";

/** Below this, a bucket gets flagged rather than believed. */
const MIN_SAMPLE = 30;

/**
 * Trading sessions by UTC hour of entry. The boundaries are the conventional
 * ones and deliberately include the London/New York overlap as its own bucket,
 * because that window behaves nothing like either session on its own.
 */
export function sessionOf(timestamp: number): string {
  const hour = new Date(timestamp).getUTCHours();
  if (hour < 7) return "Asia (00–07 UTC)";
  if (hour < 12) return "London (07–12 UTC)";
  if (hour < 16) return "London/NY overlap (12–16 UTC)";
  if (hour < 21) return "New York (16–21 UTC)";
  return "Late (21–24 UTC)";
}

export function holdingBucketOf(trade: Trade): string {
  const hours = (trade.closeTime - trade.openTime) / 3_600_000;
  if (hours < 1) return "< 1 hour";
  if (hours < 4) return "1–4 hours";
  if (hours < 24) return "4–24 hours";
  if (hours < 24 * 7) return "1–7 days";
  return "> 7 days";
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function buildBuckets(groups: Map<string, number[]>): BucketStats[] {
  const entries = [...groups.entries()].filter(([, pnl]) => pnl.length > 0);
  const pValues = entries.map(([, pnl]) => tTestAgainstZero(pnl).p);
  const qValues = benjaminiHochberg(pValues);

  return entries
    .map(([key, pnl], index) => {
      const wins = pnl.filter((x) => x > 0).length;
      return {
        key,
        n: pnl.length,
        winRate: wins / pnl.length,
        expectancy: mean(pnl),
        totalPnl: sum(pnl),
        pValue: pValues[index],
        qValue: qValues[index],
        // Significance is judged on the adjusted q-value, not the raw p-value.
        // Slicing one track record ten ways and reporting the best slice at
        // p < 0.05 is how traders convince themselves of edges that aren't there.
        significant: qValues[index] < 0.05 && pnl.length >= MIN_SAMPLE,
        underpowered: pnl.length < MIN_SAMPLE,
      } satisfies BucketStats;
    })
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

function groupBy(trades: Trade[], keyOf: (trade: Trade) => string) {
  const groups = new Map<string, number[]>();
  for (const trade of trades) {
    const key = keyOf(trade);
    const existing = groups.get(key);
    if (existing) existing.push(trade.profit);
    else groups.set(key, [trade.profit]);
  }
  return groups;
}

export function buildBreakdowns(trades: Trade[]): Breakdown[] {
  const definitions: { name: string; keyOf: (trade: Trade) => string }[] = [
    { name: "Symbol", keyOf: (t) => t.symbol },
    { name: "Direction", keyOf: (t) => (t.direction === "long" ? "Long" : "Short") },
    { name: "Session", keyOf: (t) => sessionOf(t.openTime) },
    { name: "Day of week", keyOf: (t) => DAY_NAMES[new Date(t.openTime).getUTCDay()] },
    { name: "Holding time", keyOf: holdingBucketOf },
  ];

  return definitions.map(({ name, keyOf }) => ({
    name,
    buckets: buildBuckets(groupBy(trades, keyOf)),
  }));
}
