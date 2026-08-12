import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { installDomParser } from "./dom";
import { formatAuditReport } from "./report";
import { parseTradeFile } from "@/lib/parsers";
import { auditTradeLog } from "@/lib/stats/audit";
import { shiftToUtc } from "@/lib/timezone";
import type { Trade, TradeLog } from "@/lib/types";

installDomParser();

const timestamp = z
  .union([z.string(), z.number()])
  .describe("ISO 8601 string or epoch milliseconds");

const tradeSchema = z.object({
  symbol: z.string().optional().describe("Instrument, e.g. EURUSD"),
  direction: z
    .enum(["long", "short", "buy", "sell"])
    .optional()
    .describe("Defaults to long if omitted"),
  openTime: timestamp.optional(),
  closeTime: timestamp,
  openPrice: z.number().optional(),
  closePrice: z.number().optional(),
  volume: z.number().optional(),
  profit: z.number().describe("Net P&L in account currency, after costs"),
  commission: z.number().optional(),
  swap: z.number().optional(),
});

const optionsShape = {
  trialsTested: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      "How many strategy variants were tested before this one was chosen. Drives the Deflated Sharpe correction; defaults to 1. Ask the user rather than assuming — it is the single biggest lever on the result.",
    ),
  brokerUtcOffsetHours: z
    .number()
    .optional()
    .describe(
      "The broker's server-clock offset from UTC (MetaTrader is usually 2 or 3). Applied before the session and day-of-week breakdowns, which are otherwise displaced by that amount.",
    ),
  projectionHorizon: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Number of future trades to simulate. Defaults to max(50, sample size)."),
  seed: z
    .number()
    .int()
    .optional()
    .describe("Simulation seed. The same seed always reproduces the same figures."),
  format: z
    .enum(["markdown", "json"])
    .optional()
    .describe("markdown (default) for a readable report, json for the raw result object"),
};

type Options = {
  trialsTested?: number;
  brokerUtcOffsetHours?: number;
  projectionHorizon?: number;
  seed?: number;
  format?: "markdown" | "json";
};

function toEpochMs(value: string | number | undefined): number {
  if (value === undefined) return NaN;
  if (typeof value === "number") return value;
  const parsed = Date.parse(value.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
  return Number.isFinite(parsed) ? parsed : Date.parse(value);
}

function normaliseTrades(input: z.infer<typeof tradeSchema>[]): Trade[] {
  return input.map((raw, index) => {
    const closeTime = toEpochMs(raw.closeTime);
    const openTime = toEpochMs(raw.openTime);
    const commission = raw.commission ?? 0;
    const swap = raw.swap ?? 0;
    return {
      id: String(index),
      symbol: (raw.symbol ?? "UNKNOWN").toUpperCase(),
      direction:
        raw.direction === "short" || raw.direction === "sell" ? "short" : "long",
      openTime: Number.isFinite(openTime) ? openTime : closeTime,
      closeTime,
      openPrice: raw.openPrice ?? 0,
      closePrice: raw.closePrice ?? 0,
      volume: raw.volume ?? 0,
      profit: raw.profit,
      grossProfit: raw.profit - commission - swap,
      commission,
      swap,
    } satisfies Trade;
  });
}

function runAudit(log: TradeLog, options: Options, source: string) {
  const shifted: TradeLog = {
    ...log,
    trades: shiftToUtc(log.trades, options.brokerUtcOffsetHours ?? 0),
  };

  const result = auditTradeLog(shifted, {
    trialsTested: options.trialsTested ?? 1,
    projectionHorizon: options.projectionHorizon,
    seed: options.seed,
  });

  const text =
    options.format === "json"
      ? JSON.stringify(result, null, 2)
      : formatAuditReport(result, shifted, source);

  return { content: [{ type: "text" as const, text }] };
}

function failure(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

const server = new McpServer({
  name: "technical-analysis",
  version: "0.1.0",
});

server.registerTool(
  "audit_trades",
  {
    title: "Audit a trade history",
    description:
      "Run a statistical audit on a list of closed trades and report whether the edge is distinguishable from luck. Computes a bootstrap confidence interval on expectancy, a permutation drawdown distribution, Deflated Sharpe corrected for the number of variants tested, outlier concentration, a runs test for independence, and per-symbol/direction/session/day/holding-time breakdowns with Benjamini-Hochberg correction. Use this when trades have been fetched from a platform (for example MetaTrader over MCP) rather than read from a file. Report the verdict and its cautions — do not restate a positive net P&L as evidence of skill when the verdict says otherwise.",
    inputSchema: {
      trades: z
        .array(tradeSchema)
        .min(1)
        .describe("Closed trades. At least 30 are needed for the tests to have power."),
      ...optionsShape,
    },
  },
  async ({ trades, ...options }) => {
    const normalised = normaliseTrades(trades);
    const usable = normalised.filter((trade) => Number.isFinite(trade.closeTime));

    if (usable.length === 0) {
      return failure(
        "None of the supplied trades had a readable close time. Pass closeTime as an ISO 8601 string or epoch milliseconds.",
      );
    }

    const warnings: string[] = [];
    if (usable.length < normalised.length) {
      warnings.push(
        `${normalised.length - usable.length} trade(s) were dropped for having no readable close time.`,
      );
    }
    if (options.brokerUtcOffsetHours === undefined) {
      warnings.push(
        "No broker UTC offset was supplied, so timestamps were taken as UTC. If these came from MetaTrader they are broker server time, and the session and day-of-week breakdowns are shifted accordingly.",
      );
    }

    return runAudit(
      { source: "generic-csv", trades: usable, warnings },
      options,
      `${usable.length} supplied trades`,
    );
  },
);

server.registerTool(
  "audit_statement_file",
  {
    title: "Audit a statement file",
    description:
      "Read a trading statement from disk and run the full statistical audit on it. Accepts MetaTrader 4 detailed statements, MetaTrader 5 reports (.htm/.html), TradingView list-of-trades exports (.csv), and generic CSVs with a close date and a profit column. The format is detected from the file's content.",
    inputSchema: {
      path: z.string().describe("Absolute or relative path to the statement file"),
      ...optionsShape,
    },
  },
  async ({ path, ...options }) => {
    const full = resolve(path);
    let text: string;
    try {
      text = await readFile(full, "utf-8");
    } catch (cause) {
      return failure(
        `Could not read ${full}: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }

    const log = parseTradeFile(text, path);
    if (log.trades.length === 0) {
      return failure(
        `No trades could be read from ${full}.\n\n${log.warnings.map((w) => `- ${w}`).join("\n")}`,
      );
    }

    return runAudit(log, options, full);
  },
);

server.registerTool(
  "parse_statement_file",
  {
    title: "Parse a statement file",
    description:
      "Read a trading statement and return its trades as normalised JSON, without running the audit. Use this to inspect what was imported, to check a file the audit rejected, or to feed the trades into another tool.",
    inputSchema: {
      path: z.string().describe("Absolute or relative path to the statement file"),
      limit: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Return at most this many trades. Omit for all of them."),
    },
  },
  async ({ path, limit }) => {
    const full = resolve(path);
    let text: string;
    try {
      text = await readFile(full, "utf-8");
    } catch (cause) {
      return failure(
        `Could not read ${full}: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }

    const log = parseTradeFile(text, path);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              source: log.source,
              tradeCount: log.trades.length,
              initialBalance: log.initialBalance,
              warnings: log.warnings,
              trades: limit ? log.trades.slice(0, limit) : log.trades,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
