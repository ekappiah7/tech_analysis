import type { Trade, TradeLog } from "@/lib/types";
import { detectDelimiter, parseCsv, parseNumber, parseTimestamp } from "./csv";

function normalise(header: string): string {
  return header.replace(/\s+/g, " ").trim().toLowerCase();
}

/** First header index whose normalised text satisfies `predicate`. */
function findIndex(headers: string[], predicate: (h: string) => boolean): number {
  return headers.findIndex((header) => predicate(normalise(header)));
}

export function isTradingViewCsv(text: string): boolean {
  const firstLine = normalise(text.split(/\r?\n/, 1)[0] ?? "");
  return (
    firstLine.includes("trade #") &&
    firstLine.includes("type") &&
    (firstLine.includes("date/time") || firstLine.includes("date"))
  );
}

/**
 * TradingView's "List of Trades" export.
 *
 * Each trade occupies two rows — an entry and an exit sharing a trade number —
 * with the P&L reported only on the exit row. Column names drift between
 * TradingView versions and carry the quote currency inline ("Profit USDT",
 * "Net P&L USD"), so every lookup is by pattern rather than exact name.
 */
export function parseTradingViewCsv(text: string): TradeLog {
  const warnings: string[] = [];
  const rows = parseCsv(text, detectDelimiter(text));

  if (rows.length < 2) {
    return { source: "tradingview-csv", trades: [], warnings: ["File is empty."] };
  }

  const headers = rows[0];
  const idx = {
    tradeNumber: findIndex(headers, (h) => h.startsWith("trade #") || h === "trade"),
    type: findIndex(headers, (h) => h === "type"),
    signal: findIndex(headers, (h) => h.includes("signal")),
    dateTime: findIndex(headers, (h) => h.startsWith("date")),
    price: findIndex(headers, (h) => h.startsWith("price")),
    size: findIndex(
      headers,
      (h) =>
        h.startsWith("contracts") ||
        h.startsWith("position size") ||
        h.startsWith("quantity") ||
        h.startsWith("qty"),
    ),
    profit: findIndex(
      headers,
      (h) =>
        (h.startsWith("net p&l") || h.startsWith("profit") || h.startsWith("p&l")) &&
        !h.includes("%") &&
        !h.startsWith("cum"),
    ),
  };

  if (idx.tradeNumber < 0 || idx.type < 0 || idx.profit < 0) {
    return {
      source: "tradingview-csv",
      trades: [],
      warnings: [
        "This does not look like a TradingView list-of-trades export — expected 'Trade #', 'Type' and a profit column.",
      ],
    };
  }

  // Group the entry/exit row pairs by trade number.
  const groups = new Map<string, string[][]>();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const key = (row[idx.tradeNumber] ?? "").trim();
    if (key === "") continue;
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  }

  const symbolGuess = "TRADINGVIEW";
  const trades: Trade[] = [];
  let unpaired = 0;

  for (const [key, groupRows] of groups) {
    const typeOf = (row: string[]) => normalise(row[idx.type] ?? "");

    let entry = groupRows.find((row) => typeOf(row).includes("entry"));
    let exit = groupRows.find((row) => typeOf(row).includes("exit"));

    if (!entry || !exit) {
      // Older exports label rows "Buy"/"Sell" instead of "Entry"/"Exit"; in that
      // format the pair is positional once sorted by time.
      if (groupRows.length < 2) {
        unpaired++;
        continue;
      }
      const sorted = [...groupRows].sort(
        (a, b) =>
          parseTimestamp(a[idx.dateTime]) - parseTimestamp(b[idx.dateTime]),
      );
      entry = sorted[0];
      exit = sorted[sorted.length - 1];
    }

    // Direction always comes from the entry row: "Entry long" / "Entry short" in
    // current exports, "Buy" / "Sell" in older ones.
    const entryType = typeOf(entry);
    const direction: Trade["direction"] =
      entryType.includes("short") || entryType.includes("sell") ? "short" : "long";

    const openTime = parseTimestamp(entry[idx.dateTime]);
    const closeTime = parseTimestamp(exit[idx.dateTime]);
    const profit = parseNumber(exit[idx.profit]);

    if (!Number.isFinite(openTime) || !Number.isFinite(closeTime)) continue;
    if (!Number.isFinite(profit)) continue;

    trades.push({
      id: key,
      symbol: symbolGuess,
      direction,
      openTime,
      closeTime,
      openPrice: idx.price >= 0 ? parseNumber(entry[idx.price]) || 0 : 0,
      closePrice: idx.price >= 0 ? parseNumber(exit[idx.price]) || 0 : 0,
      volume: idx.size >= 0 ? parseNumber(entry[idx.size]) || 0 : 0,
      profit,
      grossProfit: profit,
      commission: 0,
      swap: 0,
      comment: idx.signal >= 0 ? entry[idx.signal] : undefined,
    });
  }

  trades.sort((a, b) => a.closeTime - b.closeTime);

  warnings.push(
    "TradingView exports do not carry the instrument name, so every trade is grouped under one symbol. The per-symbol breakdown will not be meaningful for this file.",
  );
  warnings.push(
    "Strategy-tester results are simulated fills. They exclude slippage and, unless you configured them, commission — so expect the live version of this strategy to perform worse.",
  );
  if (unpaired > 0) {
    warnings.push(
      `Skipped ${unpaired} trade${unpaired === 1 ? "" : "s"} with no matching exit row (still open at the end of the test).`,
    );
  }

  return { source: "tradingview-csv", trades, warnings };
}
