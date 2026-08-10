/**
 * Produces public/sample-mt4-statement.htm — a synthetic MT4 detailed statement
 * used as the app's demo file.
 *
 * The strategy it simulates is deliberately a familiar trap rather than a clean
 * winner: a high win rate built on small take-profits, funded by occasional
 * large losses, with a mild genuine edge underneath. That shape looks excellent
 * on a headline P&L and should make the audit's cautions earn their place.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../public/sample-mt4-statement.htm",
);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260809);
const SYMBOLS = [
  { name: "eurusd", digits: 5, tick: 0.0001, base: 1.085 },
  { name: "gbpusd", digits: 5, tick: 0.0001, base: 1.264 },
  { name: "xauusd", digits: 2, tick: 0.1, base: 2320.0 },
  { name: "usdjpy", digits: 3, tick: 0.01, base: 151.2 },
];

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function formatTime(date) {
  return (
    `${date.getUTCFullYear()}.${pad(date.getUTCMonth() + 1)}.${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

function money(value) {
  const formatted = Math.abs(value).toFixed(2);
  const [whole, fraction] = formatted.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "&nbsp;");
  return `${value < 0 ? "-" : ""}${grouped}.${fraction}`;
}

const rows = [];
rows.push(
  `<tr><td>100000</td><td>2025.01.06 08:00:00</td><td>balance</td><td colspan="10">Deposit</td><td>${money(10000)}</td></tr>`,
);

let cursor = Date.UTC(2025, 0, 6, 8, 30, 0);
let ticket = 100001;

for (let i = 0; i < 214; i++) {
  const symbol = SYMBOLS[Math.floor(rng() * SYMBOLS.length)];
  const isLong = rng() > 0.48;
  const volume = [0.1, 0.2, 0.3, 0.5][Math.floor(rng() * 4)];

  // Entries cluster in the London and New York sessions, as a discretionary
  // trader's would, rather than spreading uniformly across the clock.
  const gapHours = 3 + rng() * 20;
  cursor += gapHours * 3_600_000;
  const openDate = new Date(cursor);
  const day = openDate.getUTCDay();
  if (day === 6) cursor += 2 * 86_400_000;
  if (day === 0) cursor += 86_400_000;

  const open = new Date(cursor);
  const holdHours = 0.5 + rng() * 9;
  const close = new Date(cursor + holdHours * 3_600_000);

  // 72% small winners, 28% losers — but the losers are roughly three times the
  // size, which is where the fragility lives.
  const isWin = rng() < 0.72;
  const magnitude = isWin
    ? (18 + rng() * 34) * (volume / 0.1) * 0.6
    : -(46 + rng() * 120) * (volume / 0.1) * 0.6;

  // A handful of outsized winners, the kind that flatter a track record.
  const outlier = rng() < 0.02 ? 6 + rng() * 4 : 1;
  const gross = magnitude * outlier;

  const commission = -(volume * 7);
  const swap = rng() < 0.35 ? -(rng() * 4) : 0;

  const pips = Math.abs(gross) / (volume * 10) / (symbol.digits === 3 ? 1 : 1);
  const drift = pips * symbol.tick * (gross > 0 === isLong ? 1 : -1);
  const openPrice = symbol.base * (1 + (rng() - 0.5) * 0.02);
  const closePrice = openPrice + drift;

  rows.push(
    `<tr>` +
      `<td>${ticket}</td><td>${formatTime(open)}</td><td>${isLong ? "buy" : "sell"}</td>` +
      `<td>${volume.toFixed(2)}</td><td>${symbol.name}</td>` +
      `<td>${openPrice.toFixed(symbol.digits)}</td><td>0.${"0".repeat(symbol.digits - 1)}</td>` +
      `<td>0.${"0".repeat(symbol.digits - 1)}</td>` +
      `<td>${formatTime(close)}</td><td>${closePrice.toFixed(symbol.digits)}</td>` +
      `<td>${commission.toFixed(2)}</td><td>0.00</td><td>${swap.toFixed(2)}</td>` +
      `<td>${money(gross)}</td>` +
      `</tr>`,
  );

  ticket++;
  cursor = close.getTime();
}

const html = `<html>
<head><title>Statement: 5012345</title></head>
<body bgcolor="#FFFFFF">
<div align="center">
<b>Sample Account Statement</b><br/>
<b>Account:</b> 5012345 &nbsp; <b>Currency:</b> USD &nbsp; <b>Leverage:</b> 1:100
<table border="1" cellpadding="3" cellspacing="0">
<tr align="center" bgcolor="#C0C0C0">
<td>Ticket</td><td>Open Time</td><td>Type</td><td>Size</td><td>Item</td>
<td>Price</td><td>S / L</td><td>T / P</td><td>Close Time</td><td>Price</td>
<td>Commission</td><td>Taxes</td><td>Swap</td><td>Profit</td>
</tr>
${rows.join("\n")}
</table>
</div>
</body>
</html>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html, "utf-8");
console.log(`Wrote ${OUT} (${rows.length - 1} trades)`);
