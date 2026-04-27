import { MCCard, CardHeader } from "@/components/mc/Primitives";
import { useLinkedinPosts, useLinkedinWeekly } from "@/lib/queries";
import { fmtNum, fmtDate } from "@/lib/format";
import { Link } from "@tanstack/react-router";
import { ResponsiveContainer, LineChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo } from "react";

type LinkedInAccount = "Christine" | "Mark";

interface LinkedInWidgetProps {
  account?: LinkedInAccount;
}

const ACCENT: Record<LinkedInAccount, string> = {
  Christine: "#C4924A", // gold
  Mark: "#6B8E7F",      // sage
};

export function LinkedInWidget({ account = "Christine" }: LinkedInWidgetProps) {
  const postsQ = useLinkedinPosts();
  const weeklyQ = useLinkedinWeekly();

  const posts = useMemo(
    () => (postsQ.data ?? []).filter((p: any) => (p.account_label ?? "Christine") === account),
    [postsQ.data, account]
  );
  const weekly = useMemo(
    () => (weeklyQ.data ?? []).filter((w: any) => (w.account_label ?? "Christine") === account),
    [weeklyQ.data, account]
  );

  const latestFollowers = useMemo(() => {
    const first = weekly.find((w: any) => w.followers_total != null);
    return first?.followers_total ?? null;
  }, [weekly]);

  // Last 30 days totals
  const last30 = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const recent = posts.filter((p: any) => p.post_date && p.post_date >= cutoff);
    return {
      posts: recent.length,
      impressions: recent.reduce((s: number, p: any) => s + (p.impressions ?? 0), 0),
      reach: recent.reduce((s: number, p: any) => s + (p.reach ?? 0), 0),
      reactions: recent.reduce((s: number, p: any) => s + (p.reactions ?? 0), 0),
    };
  }, [posts]);

  // Followers trend chart
  const chartData = useMemo(() => {
    return [...weekly]
      .filter((w: any) => w.week_ending && w.followers_total != null)
      .sort((a: any, b: any) => (a.week_ending as string).localeCompare(b.week_ending as string))
      .map((w: any) => ({ day: w.week_ending, followers: w.followers_total }));
  }, [weekly]);

  const topPost = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    return posts
      .filter((p: any) => p.post_date && p.post_date >= cutoff)
      .sort((a: any, b: any) => (b.impressions ?? 0) - (a.impressions ?? 0))[0];
  }, [posts]);

  if (posts.length === 0) {
    return (
      <MCCard className="border-dashed">
        <CardHeader title="LinkedIn — Christine" meta="No data yet" />
        <div className="p-8 text-center">
          <p className="text-[13px] text-ink-muted">Import LinkedIn metrics to populate this widget.</p>
        </div>
      </MCCard>
    );
  }

  return (
    <MCCard>
      <CardHeader
        title="LinkedIn — Christine"
        meta={
          <Link to="/linkedin" className="text-gold hover:underline">
            Drill down →
          </Link>
        }
      />
      <div className="p-6">
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-lg bg-cream border border-line-soft p-3">
            <div className="label-eyebrow text-[9px]">Followers</div>
            <div className="num-serif text-[24px] text-ink leading-none mt-1.5">
              {latestFollowers != null ? fmtNum(latestFollowers) : "—"}
            </div>
            <div className="text-[10px] text-ink-muted mt-1 uppercase tracking-[0.14em]">Total</div>
          </div>
          <div className="rounded-lg bg-cream border border-line-soft p-3">
            <div className="label-eyebrow text-[9px]">Posts (30d)</div>
            <div className="num-serif text-[24px] text-ink leading-none mt-1.5">{fmtNum(last30.posts)}</div>
            <div className="text-[10px] text-ink-muted mt-1 uppercase tracking-[0.14em]">Published</div>
          </div>
          <div className="rounded-lg bg-cream border border-line-soft p-3">
            <div className="label-eyebrow text-[9px]">Impressions (30d)</div>
            <div className="num-serif text-[24px] text-ink leading-none mt-1.5">{fmtNum(last30.impressions)}</div>
            <div className="text-[10px] text-ink-muted mt-1 uppercase tracking-[0.14em]">Total reach {fmtNum(last30.reach)}</div>
          </div>
          <div className="rounded-lg bg-cream border border-line-soft p-3">
            <div className="label-eyebrow text-[9px]">Reactions (30d)</div>
            <div className="num-serif text-[24px] text-ink leading-none mt-1.5">{fmtNum(last30.reactions)}</div>
            <div className="text-[10px] text-ink-muted mt-1 uppercase tracking-[0.14em]">Engagement</div>
          </div>
        </div>

        <div className="h-[100px] mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Line type="monotone" dataKey="followers" stroke="#C4924A" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Tooltip
                contentStyle={{ background: "#1F2937", border: "none", borderRadius: 8, color: "#F7F3EC", fontSize: 11 }}
                labelFormatter={(d: any) => fmtDate(d)}
                formatter={(v: any) => fmtNum(v)}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {topPost && (
          <div className="border-t border-line-soft pt-4">
            <div className="label-eyebrow text-[9px] mb-2">Top Post · Last 30 Days</div>
            <a href={topPost.link ?? "#"} target="_blank" rel="noreferrer" className="block group">
              <div className="text-[13px] font-medium text-ink leading-snug line-clamp-2 group-hover:text-gold transition-colors">
                {topPost.topic}
              </div>
              <div className="text-[11px] text-ink-muted mt-1 flex items-center gap-2 flex-wrap">
                <span>{fmtDate(topPost.post_date)}</span>
                <span>·</span>
                <span>{fmtNum(topPost.impressions)} impressions</span>
                <span>·</span>
                <span>{fmtNum(topPost.reactions)} reactions</span>
                {topPost.post_type && (<><span>·</span><span>{topPost.post_type}</span></>)}
              </div>
            </a>
          </div>
        )}
      </div>
    </MCCard>
  );
}
