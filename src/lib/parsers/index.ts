import type { TradeLog } from "@/lib/types";
import { isMetaTraderHtml, parseMetaTraderHtml } from "./metatrader";
import { isTradingViewCsv, parseTradingViewCsv } from "./tradingview";
import { parseGenericCsv } from "./generic";

export { parseMetaTraderHtml } from "./metatrader";
export { parseTradingViewCsv } from "./tradingview";
export { parseGenericCsv } from "./generic";

/**
 * Route a dropped file to the right importer by sniffing its content rather than
 * its extension — MetaTrader saves statements as .htm, .html and occasionally
 * .xls while the bytes stay HTML throughout.
 */
export function parseTradeFile(text: string, filename = ""): TradeLog {
  const looksHtml = /<\s*(table|html|body)[\s>]/i.test(text.slice(0, 4000));

  if (looksHtml || isMetaTraderHtml(text)) {
    const log = parseMetaTraderHtml(text);
    if (log.trades.length > 0 || log.source !== "unknown") return log;
  }

  if (isTradingViewCsv(text)) {
    return parseTradingViewCsv(text);
  }

  const log = parseGenericCsv(text);
  if (log.trades.length === 0 && filename) {
    log.warnings.push(
      `Nothing could be read from "${filename}". Supported: MetaTrader 4/5 detailed statements (.htm/.html), TradingView list-of-trades exports (.csv), or any CSV with at least a close date and a profit column.`,
    );
  }
  return log;
}
