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
