import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard, KpiTile } from "@/components/mc/Primitives";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMonthlyCostFn } from "@/server/optimization.functions";
import { useState } from "react";

export const Route = createFileRoute("/admin/optimization")({
  head: () => ({ meta: [{ title: "YouTube Optimization — Momentum" }] }),
  component: OptimizationLayout,
});

function OptimizationLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Only show the dashboard at the exact /admin/optimization path
  if (pathname !== "/admin/optimization") return <Outlet />;
  return <OptimizationDashboard />;
}

function OptimizationDashboard() {
  const [brandId, setBrandId] = useState<string>("");

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("*").eq("status", "Active").order("name");
      return data ?? [];
    },
  });

  const activeBrandId = brandId || brands[0]?.id;

  const { data: queueCount = 0 } = useQuery({
    queryKey: ["audit-queue-count", activeBrandId],
    queryFn: async () => {
      if (!activeBrandId) return 0;
      const { count } = await supabase.from("audit_queue").select("*", { count: "exact", head: true }).eq("brand_id", activeBrandId).eq("status", "queued");
      return count ?? 0;
    },
    enabled: !!activeBrandId,
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["optimization-pending-count", activeBrandId],
    queryFn: async () => {
      if (!activeBrandId) return 0;
      const { count } = await supabase.from("optimization_runs").select("*", { count: "exact", head: true }).eq("brand_id", activeBrandId).in("status", ["pending", "completed"]);
      return count ?? 0;
    },
    enabled: !!activeBrandId,
  });

  const { data: publishedCount = 0 } = useQuery({
    queryKey: ["optimization-published-count", activeBrandId],
    queryFn: async () => {
      if (!activeBrandId) return 0;
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count } = await supabase.from("optimization_runs").select("*", { count: "exact", head: true }).eq("brand_id", activeBrandId).eq("status", "published").gte("published_at", sevenDaysAgo);
      return count ?? 0;
    },
    enabled: !!activeBrandId,
  });

  const getCost = useServerFn(getMonthlyCostFn);
  const { data: costData } = useQuery({
    queryKey: ["monthly-cost"],
    queryFn: () => getCost(),
  });

  const inputCls = "w-full rounded-lg border border-line bg-cream px-3 py-2.5 text-[13px] text-ink focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30 transition";

  return (
    <PageShell>
      <PageHeader
        title="YouTube Optimization"
        subtitle="AI-Powered Content Optimization Desk"
        breadcrumbs={[{ label: "Command Center", to: "/" }, { label: "Admin", to: "/admin" }, { label: "Optimization" }]}
      />

      {/* Brand selector */}
      <div className="mb-6">
        <select className={inputCls + " max-w-xs"} value={activeBrandId ?? ""} onChange={(e) => setBrandId(e.target.value)}>
          {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link to="/admin/optimization/queue">
          <KpiTile label="Audit Queue" value={queueCount} tone="amber" trend="Videos waiting for optimization" />
        </Link>
        <Link to="/admin/optimization/review">
          <KpiTile label="In Progress / Review" value={pendingCount} tone="gold" trend="Awaiting approval" />
        </Link>
        <Link to="/admin/optimization/published">
          <KpiTile label="Published (7d)" value={publishedCount} tone="sage" trend="Optimized this week" />
        </Link>
        <KpiTile
          label="Monthly Spend"
          value={`$${costData?.totalCost?.toFixed(2) ?? "0.00"}`}
          tone="navy"
          trend={`${costData?.totalRuns ?? 0} runs · ${costData?.totalThumbnails ?? 0} thumbnails`}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link to="/admin/optimization/new" className="rounded-lg bg-gold px-6 py-2.5 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors">
          Optimize a New Video
        </Link>
        <Link to="/admin/optimization/queue" className="rounded-lg border border-line bg-paper px-6 py-2.5 text-[13px] font-medium text-ink hover:bg-cream-deep transition-colors">
          View Audit Queue
        </Link>
        <Link to="/admin/optimization/keywords" className="rounded-lg border border-line bg-paper px-6 py-2.5 text-[13px] font-medium text-ink hover:bg-cream-deep transition-colors">
          Keyword Tracking
        </Link>
        <Link to="/admin/brands" className="rounded-lg border border-line bg-paper px-6 py-2.5 text-[13px] font-medium text-ink hover:bg-cream-deep transition-colors">
          Manage Brand Voices
        </Link>
      </div>

      {/* Budget warning */}
      {(costData?.totalCost ?? 0) > 400 && (
        <MCCard className="p-4 mb-6 border-amber bg-amber-bg">
          <p className="text-[13px] text-amber font-medium">⚠ Monthly budget of $400 exceeded (${costData?.totalCost?.toFixed(2)}). Optimizations will continue but please review spend.</p>
        </MCCard>
      )}
    </PageShell>
  );
}
