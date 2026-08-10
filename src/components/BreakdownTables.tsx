import { useState } from "react";
import type { Breakdown } from "@/lib/types";
import { money, percent, pValue, signedMoney } from "@/lib/format";

interface Props {
  breakdowns: Breakdown[];
  currency?: string;
}

export default function BreakdownTables({ breakdowns, currency = "" }: Props) {
  const [active, setActive] = useState(0);
  const breakdown = breakdowns[active];
  if (!breakdown) return null;

  const anySignificant = breakdown.buckets.some((bucket) => bucket.significant);

  return (
    <section className="panel">
      <div className="flex flex-wrap items-center gap-1 border-b border-edge px-3 py-2">
        {breakdowns.map((item, index) => (
          <button
            key={item.name}
            onClick={() => setActive(index)}
            className={`rounded px-3 py-1.5 text-sm transition ${
              index === active
                ? "bg-edge text-slate-100"
                : "text-muted hover:text-slate-300"
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-edge text-left">
              <th className="px-5 py-3 font-medium text-muted">{breakdown.name}</th>
              <th className="px-3 py-3 text-right font-medium text-muted">Trades</th>
              <th className="px-3 py-3 text-right font-medium text-muted">Win rate</th>
              <th className="px-3 py-3 text-right font-medium text-muted">Per trade</th>
              <th className="px-3 py-3 text-right font-medium text-muted">Total</th>
              <th className="px-3 py-3 text-right font-medium text-muted">p</th>
              <th className="px-5 py-3 text-right font-medium text-muted">q (adj.)</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.buckets.map((bucket) => (
              <tr key={bucket.key} className="border-b border-edge/50 last:border-0">
                <td className="px-5 py-2.5">
                  <span className="text-slate-200">{bucket.key}</span>
                  {bucket.significant && (
                    <span className="ml-2 rounded bg-win/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-win">
                      holds up
                    </span>
                  )}
                  {bucket.underpowered && (
                    <span className="ml-2 rounded bg-edge px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                      too few
                    </span>
                  )}
                </td>
                <td className="tabular px-3 py-2.5 text-right text-slate-300">{bucket.n}</td>
                <td className="tabular px-3 py-2.5 text-right text-slate-300">
                  {percent(bucket.winRate, 0)}
                </td>
                <td
                  className={`tabular px-3 py-2.5 text-right ${
                    bucket.expectancy >= 0 ? "text-win" : "text-loss"
                  }`}
                >
                  {signedMoney(bucket.expectancy, currency)}
                </td>
                <td
                  className={`tabular px-3 py-2.5 text-right ${
                    bucket.totalPnl >= 0 ? "text-win" : "text-loss"
                  }`}
                >
                  {money(bucket.totalPnl, currency)}
                </td>
                <td className="tabular px-3 py-2.5 text-right text-muted">
                  {pValue(bucket.pValue)}
                </td>
                <td
                  className={`tabular px-5 py-2.5 text-right ${
                    bucket.qValue < 0.05 ? "text-slate-200" : "text-muted"
                  }`}
                >
                  {pValue(bucket.qValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-edge px-5 py-3 text-xs leading-relaxed text-muted">
        {anySignificant
          ? "Buckets marked “holds up” stay significant after correcting for the number of slices tested. Everything else is consistent with noise."
          : "No bucket survives correction for multiple testing. "}
        Cutting one track record several ways will always throw up a flattering
        segment — the q column is the raw p-value adjusted for how many
        comparisons were made (Benjamini–Hochberg), and it is the only one worth
        acting on.
      </p>
    </section>
  );
}
