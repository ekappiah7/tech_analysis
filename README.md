# Technical Analysis

Import a trade history and find out whether the edge is real or you have been lucky.

Most trading tools show you what happened. This one tells you whether what
happened means anything — a confidence interval on your expectancy, the drawdown
you *should* have expected, and a straight answer on whether a strategy with no
edge at all could have produced the same record.

Everything runs in the browser. No trade data is uploaded anywhere.

## Getting started

```bash
npm install
npm run dev          # http://localhost:8080
```

Then open the Audit page and either drop a statement in or click **Audit a
sample account** to see it work on a synthetic 214-trade record.

```bash
npm test             # 80 tests across parsers, statistics and symbol routing
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

## What it reads

| Source | Format | Notes |
|---|---|---|
| MetaTrader 4 | Detailed statement (`.htm`) | Right-click Account History → Save as Detailed Report |
| MetaTrader 5 | Trade history report (`.htm`) | Positions section |
| TradingView | List of trades (`.csv`) | Strategy Tester → Export |
| Anything else | Generic `.csv` | Needs at minimum a close date and a profit column |

The importer sniffs file content rather than trusting the extension, and reports
what it could not read instead of silently dropping rows.

Two things it will tell you about your own data, because they change how the
results should be read:

- **MetaTrader timestamps are broker server time**, not UTC — usually UTC+2 or
  UTC+3. The session and day-of-week breakdowns are shifted by that offset.
- **MetaTrader reports profit gross of costs.** Commission, swap and taxes are
  folded back in so `profit` is genuinely net.

## What it computes

**Expectancy with a bootstrap confidence interval.** Ten thousand resamples of
your own trades. If the interval contains zero, the record is consistent with
having no edge — regardless of how green the equity curve looks.

**Drawdown as a distribution, not a number.** Your trades reshuffled thousands of
times. Currency P&L is additive, so every ordering ends at the same balance;
only the path changes. That isolates how much of a smooth ride was the sequence
you happened to get. If your realised drawdown sits in the best quartile of
orderings, you have been treated kindly, and the p90 figure is the one to plan
around.

**A forward projection by resampling.** Drawn with replacement from your own P&L
distribution, so unlike the permutation test the total *does* vary. It assumes
future trades are independent draws from the same distribution — a strong
assumption that fails under regime change, which is why the runs test below
matters.

**Deflated Sharpe.** Tell it how many variants you tried before settling on this
one, and it computes the Sharpe you would expect from the best of that many
strategies with no edge whatsoever, then asks whether yours clears that bar.
Testing 200 parameter sets and keeping the winner is a selection process, not
research, and this is the correction for it. It also discounts negatively
skewed, fat-tailed returns — the shape that flatters Sharpe right up until it
doesn't.

**Concentration.** What the account looks like without your best trade, and
without your best 5%. A record carried by three outliers is not an edge.

**Streaks and a runs test.** Whether your longest losing run was actually
unusual (usually it wasn't), and whether wins and losses are independent. If
they cluster, the strategy is regime-dependent and every interval on the page is
narrower than reality.

**Breakdowns with multiple-testing correction.** By symbol, direction, session,
day of week and holding time — each with a Benjamini–Hochberg adjusted q-value.
Slice one track record five ways and something will always look profitable; the
q column is what stops you acting on it.

## Market data

| Market | Provider | Key needed |
|---|---|---|
| Crypto | Binance public API | No |
| Forex, stocks, indices, commodities | Twelve Data | Yes — free, 800 req/day |
| Daily/weekly backfill | Stooq | No key, but needs a CORS proxy |

Set `VITE_TWELVEDATA_API_KEY` in `.env`, or paste the key into the Charts page
(stored in the browser only).

Broker CFDs — `US30`, `NAS100`, `XAUUSD` and friends — are instruments your
broker writes themselves, and no free API quotes them. They are mapped to the
underlying cash index or spot price, flagged as a proxy, and labelled in the UI.
Same shape, never your fills.

Stooq sends no CORS headers, so it cannot be called from a browser directly. Set
`VITE_STOOQ_PROXY` to a proxy you control to enable it; without it the adapter
fails loudly rather than appearing to work.

## MCP server

The same statistics are exposed over the Model Context Protocol, so an AI agent
can run an audit instead of improvising one. This matters because a language
model asked "is my strategy any good?" will give a fluent, confident answer
without having run a single test — these tools give it a real one to relay.

```bash
npm run build:mcp     # bundles to dist-mcp/server.js
```

Register it with any MCP client. For Claude Code:

```json
{
  "mcpServers": {
    "technical-analysis": {
      "command": "node",
      "args": ["/absolute/path/to/tech_analysis/dist-mcp/server.js"]
    }
  }
}
```

Three tools:

| Tool | Purpose |
|---|---|
| `audit_trades` | Full audit on a list of closed trades passed as JSON — the path to use when trades were fetched from a platform |
| `audit_statement_file` | Reads a statement from disk and audits it, format detected from content |
| `parse_statement_file` | Parses only, returning normalised trades — for inspecting what was imported |

Both audit tools accept `trialsTested`, `brokerUtcOffsetHours`, `projectionHorizon`,
`seed`, and `format` (`markdown` or `json`).

The report is written to be read by a model, not just rendered: each verdict
carries an explicit statement of what it does and does not license, because a
positive net P&L under a "no evidence of edge" verdict will otherwise be
summarised as a win.

### Using it with MetaTrader 5

MetaTrader 5 gained its own MCP support in build 6030 (July 2026), which turns
the terminal into a data source an agent can query directly. Combined with this
server, the manual export step disappears:

```
MT5 (MCP server)  ->  agent  ->  this server (MCP)  ->  verdict
   reads deals        orchestrates   bootstrap, DSR, BH correction
```

The two servers do not talk to each other; the agent is the bridge, calling one
and passing the result to the other. `audit_trades` takes exactly the shape a
deals query returns — symbol, direction, open/close time, profit — and tolerates
missing fields.

Set `brokerUtcOffsetHours` when the trades come from MetaTrader. Its clock is
broker server time, usually UTC+2 or UTC+3, and without the correction the
session breakdown attributes trades to the wrong window entirely.

Note that the web app cannot use any of this: MCP servers are local processes,
and a browser page on a public domain neither can nor should reach them. The MCP
server is a separate local entry point sharing the same engine.

## Installing it as an app

The build is a PWA: a manifest, a service worker, and an install prompt. On
Android, Chrome offers "Install" and it lands on the home screen as a standalone
app. On iOS use Share -> Add to Home Screen.

Installing is worth doing because the audit is pure client-side computation —
the shell and the sample statement are precached, so a statement can be dropped
in and fully audited with no connection at all. Live charts are the only part
that needs the network, and market-data requests are deliberately never served
from cache: a chart quietly showing yesterday's price is worse than one that
fails to load.

```bash
npm run icons     # regenerate the icon set from public/favicon.svg
```

## Deploying to Firebase Hosting

The app is fully static — no server, no database, no Cloud Functions. Firebase
Hosting serves the built `dist/` directory and nothing else is required.

First time only:

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # pick your project, alias it "default"
```

That writes `.firebaserc`, which is safe to commit. `firebase.json` is already
in the repo and is configured for two things that matter:

- **SPA rewrites.** Every path falls through to `index.html`. Without this,
  loading `/audit` directly or refreshing the page returns a 404 — the router
  runs in the browser, and Hosting knows nothing about those routes.
- **Cache headers.** Hashed bundles under `/assets` are immutable for a year;
  `index.html` is never cached, so a deploy takes effect immediately rather than
  leaving you on a stale build.

Then deploy:

```bash
npm run deploy      # typecheck + lint + test, then build, then deploy
```

`npm run verify` runs the checks on their own if you want them without shipping.

### Do not put the API key in the build

Vite inlines every `VITE_*` variable into the JavaScript bundle at build time.
Setting `VITE_TWELVEDATA_API_KEY` and deploying publishes that key to anyone who
opens devtools, and a free-tier key is 800 requests/day someone else can spend.

Use the field on the Charts page instead — it stores the key in your own
browser, so you and your trainer each hold your own and neither ends up in the
bundle. `.env` is for local development only.

### A note on access

Firebase Hosting is public: anyone with the URL can open the app. That is
usually fine here, because trade files are parsed in the browser and never
uploaded — there is no stored data to expose. If you would rather it not be
reachable at all, Firebase Auth with an email allowlist is the smallest thing
that closes it, and it would need adding.

## Layout

```
src/lib/parsers/   file import — MT4/MT5, TradingView, generic CSV
src/lib/stats/     the statistics: bootstrap, Monte Carlo, Sharpe, regimes
src/lib/market/    free data adapters and CFD symbol resolution
src/components/    report panels and charts
src/pages/         Audit and Charts
```

Simulations are seeded (`mulberry32`), so the same file and seed always produce
the same numbers. A drawdown figure that changed on every page load would not be
worth reporting.

## Scope

This analyses your own past trades. It is not investment advice, it does not
issue signals, and nothing in it predicts future returns.
