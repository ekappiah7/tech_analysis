/**
 * Minimal RFC 4180 CSV reader: quoted fields, escaped quotes, embedded newlines,
 * and both CRLF and LF line endings. Broker exports break every one of those
 * rules at some point, usually in the comment column.
 */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const cleaned = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (inQuotes) {
      if (char === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Guess the delimiter from the header line — TradingView uses commas, some MT5 exports tabs. */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts: [string, number][] = [
    [",", (firstLine.match(/,/g) ?? []).length],
    ["\t", (firstLine.match(/\t/g) ?? []).length],
    [";", (firstLine.match(/;/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/**
 * Parse a number out of broker-formatted text.
 *
 * Handles space and non-breaking-space thousands separators (MetaTrader), and
 * disambiguates comma-as-decimal from comma-as-thousands by checking whether a
 * dot is also present.
 */
export function parseNumber(raw: string | undefined): number {
  if (raw == null) return NaN;
  let text = raw.replace(/[\u00a0\s]/g, "").trim();
  if (text === "" || text === "-") return NaN;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    text = text.replace(/,/g, "");
  } else if (hasComma) {
    // A lone comma with exactly two trailing digits is a decimal separator;
    // otherwise it is grouping ("1,234").
    text = /,\d{1,2}$/.test(text) ? text.replace(",", ".") : text.replace(/,/g, "");
  }

  const value = Number(text.replace(/[^0-9eE+\-.]/g, ""));
  return Number.isFinite(value) ? value : NaN;
}

/**
 * Parse the timestamp formats that appear in trading exports.
 *
 * Everything is interpreted as UTC. For MetaTrader that is a deliberate lie —
 * the statement carries broker *server* time, which is typically UTC+2/+3 — so
 * the parser records a warning and the session breakdown is offset accordingly
 * until the user sets their broker offset.
 */
export function parseTimestamp(raw: string | undefined): number {
  if (!raw) return NaN;
  const text = raw.replace(/\u00a0/g, " ").trim();
  if (text === "") return NaN;

  // 2024.03.15 09:30:12  /  2024.03.15 09:30  (MetaTrader)
  let match = text.match(
    /^(\d{4})[.\-/](\d{2})[.\-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (match) {
    const [, y, mo, d, h, mi, s] = match;
    return Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  }

  // 2024-03-15  (date only)
  match = text.match(/^(\d{4})[.\-/](\d{2})[.\-/](\d{2})$/);
  if (match) {
    const [, y, mo, d] = match;
    return Date.UTC(+y, +mo - 1, +d);
  }

  // 15/03/2024 09:30  (day-first, common in broker CSVs)
  match = text.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (match) {
    const [, d, mo, y, h, mi, s] = match;
    return Date.UTC(+y, +mo - 1, +d, h ? +h : 0, mi ? +mi : 0, s ? +s : 0);
  }

  const iso = Date.parse(text.endsWith("Z") ? text : `${text}Z`);
  if (Number.isFinite(iso)) return iso;

  const loose = Date.parse(text);
  return Number.isFinite(loose) ? loose : NaN;
}
