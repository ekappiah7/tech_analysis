import type { AssetClass, SymbolResolution } from "./types";

/**
 * Broker CFD tickers mapped to the closest publicly quoted instrument.
 *
 * This mapping is the honest part of the market-data feature. Your broker's
 * "US30" is a CFD they write themselves: it carries their spread, their
 * financing, and their rounding, and no free API quotes it. What you get here
 * is the underlying cash index, which tracks the same market but will never
 * match your fills. Anything approximate is flagged `isProxy` and labelled in
 * the UI, so a chart is never silently passed off as your instrument.
 */
interface MappingEntry {
  resolved: string;
  provider: SymbolResolution["provider"];
  assetClass: AssetClass;
  isProxy: boolean;
  note?: string;
}

const INDEX_NOTE =
  "Cash index shown in place of your broker's CFD — direction and structure track closely, but prices and spreads will differ from your fills.";

const METAL_NOTE =
  "Spot metal price. Broker contracts differ in spread and financing.";

const EXPLICIT: Record<string, MappingEntry> = {
  // Indices — the CFD tickers vary by broker, so the common aliases all map here.
  US30: { resolved: "DJI", provider: "twelvedata", assetClass: "index", isProxy: true, note: INDEX_NOTE },
  DJ30: { resolved: "DJI", provider: "twelvedata", assetClass: "index", isProxy: true, note: INDEX_NOTE },
  WS30: { resolved: "DJI", provider: "twelvedata", assetClass: "index", isProxy: true, note: INDEX_NOTE },
  NAS100: { resolved: "IXIC", provider: "twelvedata", assetClass: "index", isProxy: true, note: INDEX_NOTE },
  US100: { resolved: "IXIC", provider: "twelvedata", assetClass: "index", isProxy: true, note: INDEX_NOTE },
  USTEC: { resolved: "IXIC", provider: "twelvedata", assetClass: "index", isProxy: true, note: INDEX_NOTE },
  SPX500: { resolved: "SPX", provider: "twelvedata", assetClass: "index", isProxy: true, note: INDEX_NOTE },
  US500: { resolved: "SPX", provider: "twelvedata", assetClass: "index", isProxy: true, note: INDEX_NOTE },
  GER40: { resolved: "DAX", provider: "twelvedata", assetClass: "index", isProxy: true, note: INDEX_NOTE },
  DE40: { resolved: "DAX", provider: "twelvedata", assetClass: "index", isProxy: true, note: INDEX_NOTE },
  UK100: { resolved: "UKX", provider: "twelvedata", assetClass: "index", isProxy: true, note: INDEX_NOTE },
  JP225: { resolved: "N225", provider: "twelvedata", assetClass: "index", isProxy: true, note: INDEX_NOTE },

  // Metals and energy.
  XAUUSD: { resolved: "XAU/USD", provider: "twelvedata", assetClass: "commodity", isProxy: true, note: METAL_NOTE },
  GOLD: { resolved: "XAU/USD", provider: "twelvedata", assetClass: "commodity", isProxy: true, note: METAL_NOTE },
  XAGUSD: { resolved: "XAG/USD", provider: "twelvedata", assetClass: "commodity", isProxy: true, note: METAL_NOTE },
  USOIL: { resolved: "WTI/USD", provider: "twelvedata", assetClass: "commodity", isProxy: true, note: "Spot WTI. Your broker's oil CFD tracks a futures contract and will roll differently." },
  WTI: { resolved: "WTI/USD", provider: "twelvedata", assetClass: "commodity", isProxy: true, note: "Spot WTI. Your broker's oil CFD tracks a futures contract and will roll differently." },
};

const CRYPTO_BASES = [
  "BTC", "ETH", "SOL", "XRP", "BNB", "ADA", "DOGE", "AVAX", "LINK", "DOT",
  "MATIC", "LTC", "TRX", "SHIB", "ATOM", "UNI", "ETC", "XLM", "NEAR", "ARB",
];

const FIAT = [
  "USD", "EUR", "GBP", "JPY", "CHF", "AUD", "NZD", "CAD", "SEK", "NOK", "ZAR",
];

/** Strip the suffixes brokers append to distinguish account types: EURUSD.pro, XAUUSDm, US30_cash. */
function stripBrokerSuffix(symbol: string): string {
  return symbol
    .toUpperCase()
    .trim()
    .replace(/[._-](PRO|ECN|RAW|CASH|SPOT|MICRO|STD|C|M|I|Z)$/i, "")
    .replace(/[._-]+$/, "")
    .replace(/(?<=[A-Z]{6})M$/, "");
}

export function resolveSymbol(input: string): SymbolResolution {
  const cleaned = stripBrokerSuffix(input);

  const explicit = EXPLICIT[cleaned];
  if (explicit) {
    return { input, ...explicit };
  }

  // Crypto pairs quoted in USD/USDT route to Binance, which is keyless and exact.
  const cryptoMatch = cleaned.match(/^([A-Z]{3,5})(USDT|USD|USDC|BUSD)$/);
  if (cryptoMatch && CRYPTO_BASES.includes(cryptoMatch[1])) {
    return {
      input,
      resolved: `${cryptoMatch[1]}USDT`,
      provider: "binance",
      assetClass: "crypto",
      // Binance spot is a real venue, but it is not your broker's crypto CFD.
      isProxy: cryptoMatch[2] !== "USDT",
      note:
        cryptoMatch[2] !== "USDT"
          ? "Binance USDT pair used as the closest liquid equivalent."
          : undefined,
    };
  }

  // Six-letter fiat pairs are forex.
  if (cleaned.length === 6) {
    const base = cleaned.slice(0, 3);
    const quote = cleaned.slice(3);
    if (FIAT.includes(base) && FIAT.includes(quote)) {
      return {
        input,
        resolved: `${base}/${quote}`,
        provider: "twelvedata",
        assetClass: "forex",
        isProxy: false,
      };
    }
  }

  // Anything left is treated as an equity ticker.
  return {
    input,
    resolved: cleaned,
    provider: "twelvedata",
    assetClass: "stock",
    isProxy: false,
  };
}
