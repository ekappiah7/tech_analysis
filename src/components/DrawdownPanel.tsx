import type { DrawdownDistribution, ForwardProjection } from "@/lib/types";
import { money, percent } from "@/lib/format";

interface Props {
  drawdown: DrawdownDistribution;
  projection: ForwardProjection;
  currency?: string;
}

function Bar({
  label,
  value,
  max,
  highlight = false,
}: {
  label: string;
  value: number;
  max: number;
  highlight?: boolean;
}) {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={`w-28 shrink-0 text-xs ${highlight ? "text-slate-200" : "text-muted"}`}>
        {label}
      </span>
      <div className="h-4 flex-1 overflow-hidden rounded bg-ink">
        <div
          className={`h-full rounded ${highlight ? "bg-warn" : "bg-loss/60"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span
        className={`tabular w-28 shrink-0 text-right text-xs ${
          highlight ? "text-slate-200" : "text-muted"
        }`}
      >
        {money(value)}
      </span>
    </div>
  );
}

export default function DrawdownPanel({ drawdown, projection, currency = "" }: Props) {
  const max = Math.max(drawdown.quantiles.p99, drawdown.observed, 1);
  const lucky = drawdown.observedPercentile < 0.25;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel">
        <h3 className="panel-heading">Was your drawdown normal?</h3>
        <div className="space-y-3 p-5">
          <p className="text-sm text-muted">
            The same trades, reshuffled {drawdown.iterations.toLocaleString()} times.
            Reordering cannot change the final balance — only the path — so this
            isolates how much of your smooth ride was the sequence you happened
            to get.
          </p>
          <div className="space-y-2 pt-2">
            <Bar label="You had" value={drawdown.observed} max={max} highlight />
            <Bar label="Typical (p50)" value={drawdown.quantiles.p50} max={max} />
            <Bar label="Bad (p90)" value={drawdown.quantiles.p90} max={max} />
            <Bar label="1-in-20 (p95)" value={drawdown.quantiles.p95} max={max} />
            <Bar label="1-in-100 (p99)" value={drawdown.quantiles.p99} max={max} />
          </div>
          <p className={`pt-2 text-sm ${lucky ? "text-warn" : "text-slate-300"}`}>
            {lucky
              ? `Your ordering was kinder than ${percent(1 - drawdown.observedPercentile, 0)} of the alternatives. Plan around the p90 figure, not what you have lived through.`
              : `Your realised drawdown sits at the ${percent(drawdown.observedPercentile, 0)} mark of possible orderings — broadly what this strategy should produce.`}
          </p>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-heading">What the next {projection.horizon} trades might do</h3>
        <div className="space-y-3 p-5">
          <p className="text-sm text-muted">
            Resampled from your own trade distribution, assuming the edge holds
            and trades stay independent. Both assumptions are optimistic, so read
            the low end more seriously than the high end.
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2 text-sm">
            <div>
              <dt className="label">Worst 5%</dt>
              <dd className="tabular text-loss">{money(projection.finalPnl.p05, currency)}</dd>
            </div>
            <div>
              <dt className="label">Best 5%</dt>
              <dd className="tabular text-win">{money(projection.finalPnl.p95, currency)}</dd>
            </div>
            <div>
              <dt className="label">Median outcome</dt>
              <dd className="tabular text-slate-200">
                {money(projection.finalPnl.p50, currency)}
              </dd>
            </div>
            <div>
              <dt className="label">Chance of ending down</dt>
              <dd className="tabular text-slate-200">
                {percent(projection.probabilityOfLoss, 0)}
              </dd>
            </div>
            <div className="col-span-2 border-t border-edge pt-3">
              <dt className="label">Drawdown to survive (1-in-20)</dt>
              <dd className="tabular text-warn">
                {money(projection.maxDrawdown.p95, currency)}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
