export type MetaInsightRow = {
  snapshot_date?: string | null;
  meta_campaign_id?: string | null;
  meta_adset_id?: string | null;
  meta_ad_id?: string | null;
  spend?: number | string | null;
  leads?: number | string | null;
  clicks?: number | string | null;
  impressions?: number | string | null;
  reach?: number | string | null;
};

export type MetaMetricTotals = {
  spend: number;
  leads: number;
  clicks: number;
  impressions: number;
  reach: number;
  cpl: number | null;
  ctr: number | null;
};

const emptyBase = { spend: 0, leads: 0, clicks: 0, impressions: 0, reach: 0 };

export function utcDateRangeForLastNDays(days: number, now = new Date()) {
  const safeDays = Math.max(1, Math.floor(days));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (safeDays - 1));
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

export function aggregateMetaMetrics(rows: MetaInsightRow[]): MetaMetricTotals {
  const totals = { ...emptyBase };
  for (const row of rows) {
    totals.spend += Number(row.spend ?? 0);
    totals.leads += Number(row.leads ?? 0);
    totals.clicks += Number(row.clicks ?? 0);
    totals.impressions += Number(row.impressions ?? 0);
    totals.reach += Number(row.reach ?? 0);
  }
  return finalizeMetaTotals(totals);
}

export function groupMetaMetricsBy<T extends MetaInsightRow>(rows: T[], key: keyof T) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const groupKey = row[key];
    if (typeof groupKey !== "string" || !groupKey) continue;
    const group = groups.get(groupKey) ?? [];
    group.push(row);
    groups.set(groupKey, group);
  }
  const totals = new Map<string, MetaMetricTotals>();
  groups.forEach((group, groupKey) => totals.set(groupKey, aggregateMetaMetrics(group)));
  return totals;
}

export function aggregateMetaMetricsByDay(rows: MetaInsightRow[]) {
  return Array.from(groupMetaMetricsBy(rows, "snapshot_date").entries())
    .map(([date, totals]) => ({ date, ...totals }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function finalizeMetaTotals(totals: typeof emptyBase): MetaMetricTotals {
  return {
    ...totals,
    cpl: totals.leads > 0 ? totals.spend / totals.leads : null,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null,
  };
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}