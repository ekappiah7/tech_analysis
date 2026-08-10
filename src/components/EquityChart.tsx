import { useMemo } from "react";
import { money, shortDate } from "@/lib/format";

interface Props {
  points: { t: number; equity: number }[];
  currency?: string;
}

const WIDTH = 800;
const HEIGHT = 260;
const PAD = { top: 16, right: 12, bottom: 24, left: 64 };

/**
 * Equity curve with the underwater (drawdown-from-peak) region shaded.
 *
 * The shading is the point: a rising equity line looks the same whether it got
 * there smoothly or through a 40% hole, and the hole is what decides whether a
 * trader can actually sit through the strategy.
 */
export default function EquityChart({ points, currency = "" }: Props) {
  const model = useMemo(() => {
    if (points.length < 2) return null;

    const equities = points.map((p) => p.equity);
    let min = Math.min(...equities);
    let max = Math.max(...equities);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const headroom = (max - min) * 0.08;
    min -= headroom;
    max += headroom;

    const innerWidth = WIDTH - PAD.left - PAD.right;
    const innerHeight = HEIGHT - PAD.top - PAD.bottom;

    const x = (index: number) =>
      PAD.left + (index / (points.length - 1)) * innerWidth;
    const y = (value: number) =>
      PAD.top + ((max - value) / (max - min)) * innerHeight;

    const line = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.equity).toFixed(2)}`)
      .join(" ");

    // Running peak defines the underwater band between peak and current equity.
    let peak = -Infinity;
    const peaks = points.map((p) => {
      peak = Math.max(peak, p.equity);
      return peak;
    });

    const underwater = [
      ...peaks.map((value, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(value).toFixed(2)}`),
      ...points
        .map((p, i) => ({ p, i }))
        .reverse()
        .map(({ p, i }) => `L${x(i).toFixed(2)},${y(p.equity).toFixed(2)}`),
      "Z",
    ].join(" ");

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
      const value = min + (max - min) * fraction;
      return { value, y: y(value) };
    });

    return { line, underwater, ticks, x, y, min, max };
  }, [points]);

  if (!model) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted">
        Not enough trades to draw a curve.
      </div>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const up = last.equity >= first.equity;

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-[260px] w-full"
        role="img"
        aria-label="Equity curve with drawdown shaded"
      >
        {model.ticks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={tick.y}
              y2={tick.y}
              stroke="#1e2530"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PAD.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              className="tabular"
              fontSize={11}
              fill="#8b97a8"
            >
              {money(tick.value, currency)}
            </text>
          </g>
        ))}

        <path d={model.underwater} fill="#ef5350" fillOpacity={0.14} />
        <path
          d={model.line}
          fill="none"
          stroke={up ? "#26a69a" : "#ef5350"}
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="flex justify-between px-1 text-xs text-muted">
        <span>{shortDate(first.t)}</span>
        <span className="text-slate-400">
          shaded area = distance below the running peak
        </span>
        <span>{shortDate(last.t)}</span>
      </div>
    </div>
  );
}
