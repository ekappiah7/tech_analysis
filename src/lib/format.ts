export function money(value: number, currency = ""): string {
  if (!Number.isFinite(value)) return "—";
  const formatted = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = value < 0 ? "−" : "";
  return `${sign}${currency}${formatted}`;
}

export function signedMoney(value: number, currency = ""): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const formatted = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${currency}${formatted}`;
}

export function percent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function ratio(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "—";
  return value.toFixed(digits);
}

/** Small p-values are more honestly shown as a bound than as 0.0000. */
export function pValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value < 0.0001) return "< 0.0001";
  return value.toFixed(4);
}

export function shortDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp === 0) return "—";
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function duration(fromMs: number, toMs: number): string {
  const days = Math.round((toMs - fromMs) / 86_400_000);
  if (!Number.isFinite(days) || days <= 0) return "—";
  if (days < 60) return `${days} days`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} months`;
  return `${(days / 365.25).toFixed(1)} years`;
}
