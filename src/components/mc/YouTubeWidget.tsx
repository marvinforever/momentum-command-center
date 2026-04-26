import { MCCard, CardHeader } from "@/components/mc/Primitives";
import { useChannelMetrics, useYoutubeContent } from "@/lib/queries";
import { fmtNum, fmtDate } from "@/lib/format";
import { Link } from "@tanstack/react-router";
import { ResponsiveContainer, LineChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo } from "react";

const CHANNEL_COLORS: Record<string, string> = {
  "Christine Jewell": "#C4924A", // gold
  "Intentional Ag Leader": "#6B8E7F", // sage
};

export function YouTubeWidget() {
  const metricsQ = useChannelMetrics();
  const contentQ = useYoutubeContent();

  const ytSnapshots = useMemo(
    () => (metricsQ.data ?? []).filter((m: any) => m.channel === "YouTube" && m.account_label),
    [metricsQ.data]
  );

  // Most recent snapshot per channel
  const latestByChannel = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of ytSnapshots) {
      const existing = map.get(s.account_label);
      if (!existing || s.snapshot_date > existing.snapshot_date) map.set(s.account_label, s);
    }
    return Array.from(map.values());
  }, [ytSnapshots]);

  // 30-day subscriber growth chart, two series
  const chartData = useMemo(() => {
    const days: Record<string, any> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      days[d] = { day: d };
    }
    for (const s of ytSnapshots) {
      if (!days[s.snapshot_date]) continue;
      days[s.snapshot_date][s.account_label] = s.followers_subs;
    }
    // Forward-fill so lines connect through gap days
    const labels = Array.from(new Set(ytSnapshots.map((s: any) => s.account_label)));
    const sorted = Object.values(days).sort((a: any, b: any) => a.day.localeCompare(b.day));
    let last: Record<string, number> = {};
    for (const row of sorted as any[]) {
      for (const label of labels) {
        if (row[label] != null) last[label] = row[label];
        else if (last[label] != null) row[label] = last[label];
      }
    }
    return sorted;
  }, [ytSnapshots]);

  const mostRecentVideo = useMemo(() => (contentQ.data ?? [])[0], [contentQ.data]);

  if (ytSnapshots.length === 0) {
    return (
      <MCCard className="border-dashed">
        <CardHeader title="YouTube Performance" meta="No data yet" />
        <div className="p-8 text-center">
          <p className="text-[13px] text-ink-muted mb-4">
            Run your first YouTube sync to populate this widget.
          </p>
          <Link
            to="/admin/integrations"
            className="inline-block rounded-lg bg-gold px-5 py-2 text-[12px] font-medium text-white hover:bg-gold/90 transition-colors"
          >
            Run Sync →
          </Link>
        </div>
      </MCCard>
    );
  }

  return (
    <MCCard>
      <CardHeader title="YouTube Performance" meta="Both channels · Last 30d" />
      <div className="p-6">
        <div className="grid grid-cols-2 gap-3 mb-5">
          {latestByChannel.map((s) => (
            <div key={s.account_label} className="rounded-lg bg-cream border border-line-soft p-3">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: CHANNEL_COLORS[s.account_label] ?? "#C4924A" }}
                />
                <span className="text-[11px] text-ink-soft font-medium truncate">{s.account_label}</span>
              </div>
              <div className="num-serif text-[24px] text-ink leading-none">
                {fmtNum(s.followers_subs)}
              </div>
              <div className="text-[10px] text-ink-muted mt-1 uppercase tracking-[0.14em]">
                Subscribers
              </div>
              <div className="text-[11px] text-ink-soft mt-2">
                {fmtNum(s.reach_28d)} views · 28d
              </div>
            </div>
          ))}
        </div>

        <div className="h-[100px] mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" hide />
              <YAxis hide domain={["auto", "auto"]} />
              {latestByChannel.map((s) => (
                <Line
                  key={s.account_label}
                  type="monotone"
                  dataKey={s.account_label}
                  stroke={CHANNEL_COLORS[s.account_label] ?? "#C4924A"}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
              <Tooltip
                contentStyle={{
                  background: "#1F2937", border: "none", borderRadius: 8,
                  color: "#F7F3EC", fontSize: 11,
                }}
                labelFormatter={(d: any) => fmtDate(d)}
                formatter={(v: any) => fmtNum(v)}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {mostRecentVideo && (
          <div className="border-t border-line-soft pt-4">
            <div className="label-eyebrow text-[9px] mb-2">Most Recent Upload</div>
            <a
              href={mostRecentVideo.link ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="block group"
            >
              <div className="text-[13px] font-medium text-ink leading-snug line-clamp-2 group-hover:text-gold transition-colors">
                {mostRecentVideo.title}
              </div>
              <div className="text-[11px] text-ink-muted mt-1 flex items-center gap-2">
                <span>{fmtDate(mostRecentVideo.publish_date)}</span>
                <span>·</span>
                <span>{fmtNum(mostRecentVideo.reach)} views</span>
                <span>·</span>
                <span>{mostRecentVideo.channel}</span>
              </div>
            </a>
          </div>
        )}
      </div>
    </MCCard>
  );
}
