export function fmtNum(n: number | null | undefined, opts?: Intl.NumberFormatOptions) {
  if (n === null || n === undefined || isNaN(n as number)) return "—";
  return new Intl.NumberFormat("en-US", opts).format(n);
}

export function fmtUSD(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n as number)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtPct(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || isNaN(n as number)) return "—";
  return `${n.toFixed(digits)}%`;
}

// Parse a date value safely. Date-only strings like "2026-04-28" are
// interpreted in the LOCAL timezone (not UTC) so they don't shift to the
// previous day for users west of UTC.
function toLocalDate(d: string | Date): Date {
  if (d instanceof Date) return d;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(d);
}

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return toLocalDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateShort(d: string | Date | null | undefined) {
  if (!d) return "—";
  return toLocalDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function timeAgo(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDateShort(date);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
