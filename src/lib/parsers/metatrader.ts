import type { SourceFormat, Trade, TradeLog } from "@/lib/types";
import { parseNumber, parseTimestamp } from "./csv";

function normaliseHeader(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .trim()
    .toLowerCase()
    .replace(/:$/, "");
}

function cellText(cell: Element): string {
  return (cell.textContent ?? "").replace(/\u00a0/g, " ").trim();
}

/** All table rows in the document, as arrays of trimmed cell text. */
function extractRows(doc: Document): { cells: string[]; element: Element }[] {
  return [...doc.querySelectorAll("tr")].map((tr) => ({
    cells: [...tr.children]
      .filter((child) => child.tagName === "TD" || child.tagName === "TH")
      .map(cellText),
    element: tr,
  }));
}

interface ColumnMap {
  variant: "mt4" | "mt5";
  openTime: number;
  closeTime: number;
  type: number;
  symbol: number;
  volume: number;
  openPrice: number;
  closePrice: number;
  commission: number;
  swap: number;
  taxes: number;
  profit: number;
  ticket: number;
  comment: number;
}

/**
 * Locate the closed-trades header row and map it to column indices.
 *
 * MT4 and MT5 both repeat column names — MT5 has two "Time" columns and both
 * have two "Price" columns — so names alone are ambiguous and every lookup has
 * to be positional. `indicesOf` returns every position a name appears at, and
 * open/close are taken as the first and second occurrence.
 */
function findColumns(headerCells: string[]): ColumnMap | null {
  const headers = headerCells.map(normaliseHeader);
  const indicesOf = (name: string) =>
    headers.reduce<number[]>((acc, header, index) => {
      if (header === name) acc.push(index);
      return acc;
    }, []);

  const typeIndex = indicesOf("type")[0] ?? -1;
  const profitIndex = indicesOf("profit")[0] ?? -1;
  if (typeIndex < 0 || profitIndex < 0) return null;

  const priceIndices = indicesOf("price");
  const timeIndices = indicesOf("time");
  const isMt4 = headers.includes("item") || headers.includes("open time");

  const openTime = isMt4 ? (indicesOf("open time")[0] ?? -1) : (timeIndices[0] ?? -1);
  const closeTime = isMt4
    ? (indicesOf("close time")[0] ?? -1)
    : (timeIndices[1] ?? -1);

  if (openTime < 0 || closeTime < 0 || priceIndices.length < 2) return null;

  return {
    variant: isMt4 ? "mt4" : "mt5",
    openTime,
    closeTime,
    type: typeIndex,
    symbol: isMt4
      ? (indicesOf("item")[0] ?? -1)
      : (indicesOf("symbol")[0] ?? -1),
    volume: isMt4
      ? (indicesOf("size")[0] ?? -1)
      : (indicesOf("volume")[0] ?? -1),
    openPrice: priceIndices[0],
    closePrice: priceIndices[1],
    commission: indicesOf("commission")[0] ?? -1,
    swap: indicesOf("swap")[0] ?? -1,
    taxes: indicesOf("taxes")[0] ?? -1,
    profit: profitIndex,
    ticket: isMt4
      ? (indicesOf("ticket")[0] ?? -1)
      : (indicesOf("position")[0] ?? -1),
    comment: indicesOf("comment")[0] ?? -1,
  };
}

function at(cells: string[], index: number): string | undefined {
  return index >= 0 ? cells[index] : undefined;
}

export function isMetaTraderHtml(text: string): boolean {
  const head = text.slice(0, 4000).toLowerCase();
  return (
    head.includes("<table") &&
    (head.includes("metatrader") ||
      head.includes("metaquotes") ||
      head.includes("statement") ||
      head.includes("trade history report"))
  );
}

export function parseMetaTraderHtml(text: string): TradeLog {
  const warnings: string[] = [];
  const doc = new DOMParser().parseFromString(text, "text/html");
  const rows = extractRows(doc);

  let columns: ColumnMap | null = null;
  let headerIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    const candidate = findColumns(rows[i].cells);
    if (candidate) {
      columns = candidate;
      headerIndex = i;
      break;
    }
  }

  if (!columns) {
    return {
      source: "unknown",
      trades: [],
      warnings: [
        "Could not find a closed-trades table in this file. Export the full statement from MetaTrader (right-click the Account History tab → Save as Detailed Report) and try again.",
      ],
    };
  }

  const source: SourceFormat = columns.variant === "mt4" ? "mt4-html" : "mt5-html";
  const trades: Trade[] = [];
  let initialBalance: number | undefined;
  let skippedOpen = 0;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const { cells } = rows[i];
    const type = (at(cells, columns.type) ?? "").toLowerCase().trim();

    if (type === "balance" || type === "credit") {
      // Balance rows span the middle columns with a single colspan'd comment
      // cell, so the amount is not at the profit index — it is the last cell.
      const last = [...cells].reverse().find((value) => value.trim() !== "");
      const amount = parseNumber(last);
      // The first balance entry is the opening deposit; later ones are top-ups
      // and withdrawals, which must not be mistaken for trading profit.
      if (initialBalance === undefined && Number.isFinite(amount)) {
        initialBalance = amount;
      }
      continue;
    }

    if (type !== "buy" && type !== "sell") continue;

    const openTime = parseTimestamp(at(cells, columns.openTime));
    const closeTime = parseTimestamp(at(cells, columns.closeTime));

    if (!Number.isFinite(openTime)) continue;
    if (!Number.isFinite(closeTime)) {
      // Still-open positions appear in the same report with a blank close time.
      skippedOpen++;
      continue;
    }

    const grossProfit = parseNumber(at(cells, columns.profit));
    if (!Number.isFinite(grossProfit)) continue;

    const commission = parseNumber(at(cells, columns.commission)) || 0;
    const swap = parseNumber(at(cells, columns.swap)) || 0;
    const taxes = parseNumber(at(cells, columns.taxes)) || 0;

    trades.push({
      id: at(cells, columns.ticket) || `row-${i}`,
      symbol: (at(cells, columns.symbol) ?? "unknown").trim().toUpperCase(),
      direction: type === "buy" ? "long" : "short",
      openTime,
      closeTime,
      openPrice: parseNumber(at(cells, columns.openPrice)) || 0,
      closePrice: parseNumber(at(cells, columns.closePrice)) || 0,
      volume: parseNumber(at(cells, columns.volume)) || 0,
      // MetaTrader reports Profit gross of costs and itemises them separately.
      profit: grossProfit + commission + swap + taxes,
      grossProfit,
      commission,
      swap,
      comment: at(cells, columns.comment),
    });
  }

  if (trades.length > 0) {
    warnings.push(
      "MetaTrader statements record broker server time, not UTC — most brokers run UTC+2 or UTC+3. Session and day-of-week breakdowns are shifted by that offset until you correct for it.",
    );
  }
  if (skippedOpen > 0) {
    warnings.push(
      `Skipped ${skippedOpen} position${skippedOpen === 1 ? "" : "s"} that had not closed yet. Only closed trades can be audited.`,
    );
  }
  if (trades.length === 0) {
    warnings.push("Found the trade table but no closed trades in it.");
  }

  return { source, trades, initialBalance, warnings };
}
