import type { Trade, TradeLog } from "@/lib/types";
import { detectDelimiter, parseCsv, parseNumber, parseTimestamp } from "./csv";

/**
 * Column aliases for the fallback importer, most-specific first.
 *
 * This is what catches hand-kept spreadsheets and the long tail of broker CSVs
 * that match none of the named formats. It only needs a close time and a P&L to
 * produce a usable audit — everything else degrades gracefully.
 */
const ALIASES = {
  symbol: ["symbol", "instrument", "pair", "item", "market", "ticker", "asset"],
  direction: ["direction", "side", "type", "position", "buy/sell", "action"],
  openTime: ["open time", "entry time", "opened", "entry date", "open date", "date/time", "open"],
  closeTime: ["close time", "exit time", "closed", "exit date", "close date", "close"],
  openPrice: ["open price", "entry price", "entry", "price open", "open rate"],
  closePrice: ["close price", "exit price", "exit", "price close", "close rate"],
  volume: ["volume", "size", "lots", "quantity", "qty", "contracts", "units"],
  profit: ["net profit", "net p&l", "profit", "p&l", "pnl", "result", "gain", "realized p&l"],
  commission: ["commission", "fee", "fees"],
  swap: ["swap", "rollover", "financing"],
} as const;

function normalise(header: string): string {
  return header.replace(/\s+/g, " ").trim().toLowerCase();
}

function matchColumn(headers: string[], aliases: readonly string[]): number {
  const normalised = headers.map(normalise);
  for (const alias of aliases) {
    const exact = normalised.indexOf(alias);
    if (exact >= 0) return exact;
  }
  for (const alias of aliases) {
    const partial = normalised.findIndex((header) => header.includes(alias));
    if (partial >= 0) return partial;
  }
  return -1;
}

export function parseGenericCsv(text: string): TradeLog {
  const warnings: string[] = [];
  const rows = parseCsv(text, detectDelimiter(text));

  if (rows.length < 2) {
    return { source: "generic-csv", trades: [], warnings: ["File is empty."] };
  }

  const headers = rows[0];
  const idx = Object.fromEntries(
    Object.entries(ALIASES).map(([field, aliases]) => [
      field,
      matchColumn(headers, aliases),
    ]),
  ) as Record<keyof typeof ALIASES, number>;

  if (idx.profit < 0) {
    return {
      source: "generic-csv",
      trades: [],
      warnings: [
        `Could not find a profit column. Expected one of: ${ALIASES.profit.join(", ")}. Columns found: ${headers.join(", ")}.`,
      ],
    };
  }

  const cell = (row: string[], index: number) =>
    index >= 0 ? row[index] : undefined;

  const trades: Trade[] = [];
  let dropped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const profit = parseNumber(cell(row, idx.profit));
    if (!Number.isFinite(profit)) {
      dropped++;
      continue;
    }

    const closeTime = parseTimestamp(cell(row, idx.closeTime));
    const openTime = parseTimestamp(cell(row, idx.openTime));
    // A close time is the one field the audit cannot work without — it orders
    // the equity curve. Fall back to the open time when only one is present.
    const resolvedClose = Number.isFinite(closeTime) ? closeTime : openTime;
    const resolvedOpen = Number.isFinite(openTime) ? openTime : closeTime;

    if (!Number.isFinite(resolvedClose)) {
      dropped++;
      continue;
    }

    const rawDirection = normalise(cell(row, idx.direction) ?? "");
    const commission = parseNumber(cell(row, idx.commission)) || 0;
    const swap = parseNumber(cell(row, idx.swap)) || 0;

    trades.push({
      id: `row-${i}`,
      symbol: (cell(row, idx.symbol) ?? "UNKNOWN").trim().toUpperCase() || "UNKNOWN",
      direction:
        rawDirection.includes("sell") || rawDirection.includes("short")
          ? "short"
          : "long",
      openTime: resolvedOpen,
      closeTime: resolvedClose,
      openPrice: parseNumber(cell(row, idx.openPrice)) || 0,
      closePrice: parseNumber(cell(row, idx.closePrice)) || 0,
      volume: parseNumber(cell(row, idx.volume)) || 0,
      profit,
      grossProfit: profit - commission - swap,
      commission,
      swap,
    });
  }

  trades.sort((a, b) => a.closeTime - b.closeTime);

  if (dropped > 0) {
    warnings.push(
      `Skipped ${dropped} row${dropped === 1 ? "" : "s"} with no readable profit or date.`,
    );
  }
  if (idx.symbol < 0) {
    warnings.push("No symbol column found — the per-symbol breakdown is unavailable.");
  }
  if (idx.direction < 0) {
    warnings.push("No direction column found — every trade was recorded as long.");
  }
  warnings.push(
    "Read with the generic importer: the profit column is taken as already net of costs. If your file lists commission separately and also excludes it from profit, the audit will be optimistic.",
  );

  return { source: "generic-csv", trades, warnings };
}
