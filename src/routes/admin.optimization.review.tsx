import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard } from "@/components/mc/Primitives";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/optimization/review")({
  head: () => ({ meta: [{ title: "Review Queue — Momentum" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const [brandId, setBrandId] = useState("");
  const qc = useQueryClient();

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("*").eq("status", "Active").order("name");
      return data ?? [];
    },
  });

  const activeBrandId = brandId || brands[0]?.id;

  const { data: runs = [] } = useQuery({
    queryKey: ["review-runs", activeBrandId],
    queryFn: async () => {
      if (!activeBrandId) return [];
      const { data } = await supabase
        .from("optimization_runs")
        .select("*, youtube_videos(id, youtube_video_id, current_title, current_thumbnail_url, views)")
        .eq("brand_id", activeBrandId)
        .in("status", ["completed", "approved_by_user"])
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!activeBrandId,
  });

  const inputCls = "rounded-lg border border-line bg-cream px-3 py-2.5 text-[13px] text-ink focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30 transition";

  return (
    <PageShell>
      <PageHeader
        title="Review & Approve"
        subtitle="Christine / Mark review queue"
        breadcrumbs={[
          { label: "Command Center", to: "/" },
          { label: "Optimization", to: "/admin/optimization" },
          { label: "Review" },
        ]}
      />

      <div className="mb-6">
        <select className={inputCls + " max-w-xs"} value={activeBrandId ?? ""} onChange={(e) => setBrandId(e.target.value)}>
          {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {runs.length === 0 ? (
        <MCCard className="p-8 text-center">
          <p className="text-[14px] text-ink-muted">No optimizations awaiting review.</p>
        </MCCard>
      ) : (
        <div className="space-y-4">
          {runs.map((run: any) => (
            <ReviewRunCard key={run.id} run={run} brandId={activeBrandId} onUpdate={() => qc.invalidateQueries({ queryKey: ["review-runs"] })} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function ReviewRunCard({ run, brandId, onUpdate }: { run: any; brandId: string; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const video = run.youtube_videos;

  const { data: outputs = [] } = useQuery({
    queryKey: ["review-outputs", run.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("optimization_outputs")
        .select("*")
        .eq("optimization_run_id", run.id)
        .order("output_type")
        .order("variant_index");
      return data ?? [];
    },
    enabled: expanded,
  });

  const selectedOutputs = outputs.filter((o: any) => o.selected_by_user);

  async function handleApprove(outputId: string, outputType: string, content: string) {
    await supabase.from("approval_feedback").insert({
      optimization_output_id: outputId,
      brand_id: brandId,
      output_type: outputType,
      output_content: content,
      rating: "approved",
      reason: "Approved in review",
    });
    toast.success("Approved!");
    onUpdate();
  }

  async function handleReject(outputId: string, outputType: string, content: string) {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    await supabase.from("approval_feedback").insert({
      optimization_output_id: outputId,
      brand_id: brandId,
      output_type: outputType,
      output_content: content,
      rating: "rejected",
      reason: rejectReason,
    });

    // Add to rejected examples in voice profile
    if (outputType === "title") {
      const { data: profile } = await supabase
        .from("brand_voice_profiles")
        .select("id, rejected_title_examples")
        .eq("brand_id", brandId)
        .single();
      if (profile) {
        const existing = (profile.rejected_title_examples as any[]) ?? [];
        await supabase
          .from("brand_voice_profiles")
          .update({
            rejected_title_examples: [...existing, { title: content, reason: rejectReason }].slice(-20),
          })
          .eq("id", profile.id);
      }
    }

    setRejectingId(null);
    setRejectReason("");
    toast.success("Rejected. Feedback recorded for learning loop.");
    onUpdate();
  }

  async function handlePublishRun() {
    await supabase.from("optimization_runs").update({
      status: "published",
      published_at: new Date().toISOString(),
    }).eq("id", run.id);

    // Create performance baseline
    const { data: vid } = await supabase.from("youtube_videos").select("views, impressions, ctr, watch_time_minutes").eq("id", run.youtube_video_id).single();
    if (vid) {
      await supabase.from("optimization_performance").insert({
        optimization_run_id: run.id,
        youtube_video_id: run.youtube_video_id,
        baseline_views: vid.views,
        baseline_impressions: vid.impressions,
        baseline_ctr: vid.ctr,
        baseline_watch_time_minutes: vid.watch_time_minutes,
        baseline_taken_at: new Date().toISOString(),
      });
    }

    await supabase.from("youtube_videos").update({
      optimization_status: "optimization_published",
      last_optimized_at: new Date().toISOString(),
    }).eq("id", run.youtube_video_id);

    toast.success("Marked as published! Performance tracking started.");
    onUpdate();
  }

  return (
    <MCCard className="overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-4 p-4 text-left hover:bg-cream-deep transition-colors">
        {video?.current_thumbnail_url && (
          <img src={video.current_thumbnail_url} alt="" className="w-24 h-14 rounded object-cover" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-ink font-medium truncate">{video?.current_title ?? "Unknown"}</p>
          <p className="text-[11px] text-ink-muted">
            Run {new Date(run.created_at).toLocaleDateString()} · Status: {run.status} · Cost: ${run.cost_usd?.toFixed(2) ?? "0.00"}
          </p>
        </div>
        <span className={cn("mc-tag", run.status === "approved_by_user" ? "bg-sage-bg text-sage" : "bg-gold-bg text-gold")}>
          {run.status === "approved_by_user" ? "Approved" : "Pending Review"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-line p-4 space-y-4">
          {/* Show selected outputs side-by-side with originals */}
          {selectedOutputs.length > 0 ? (
            selectedOutputs.map((o: any) => (
              <div key={o.id} className="p-3 rounded-lg bg-cream border border-line-soft">
                <p className="label-eyebrow mb-2 capitalize">{o.output_type.replace(/_/g, " ")}</p>
                <p className="text-[13px] text-ink whitespace-pre-wrap">{o.content}</p>
                <p className="text-[11px] text-ink-muted mt-1 italic">{o.rationale}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleApprove(o.id, o.output_type, o.content)} className="rounded-md bg-sage px-3 py-1.5 text-[11px] font-medium text-white hover:bg-sage/90">
                    ✓ Approve
                  </button>
                  <button onClick={() => setRejectingId(rejectingId === o.id ? null : o.id)} className="rounded-md bg-burgundy px-3 py-1.5 text-[11px] font-medium text-white hover:bg-burgundy/90">
                    ✕ Reject
                  </button>
                </div>
                {rejectingId === o.id && (
                  <div className="mt-2 flex gap-2">
                    <input
                      className="flex-1 rounded-md border border-line bg-paper px-2 py-1.5 text-[12px]"
                      placeholder="Reason (e.g., too hype-y for Christine)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <button onClick={() => handleReject(o.id, o.output_type, o.content)} className="rounded-md bg-burgundy px-3 py-1.5 text-[11px] font-medium text-white">
                      Submit
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-[13px] text-ink-muted">No outputs selected yet. Go to the optimization workflow to select options first.</p>
          )}

          {/* Publish button */}
          {run.status === "approved_by_user" && (
            <button onClick={handlePublishRun} className="rounded-lg bg-gold px-6 py-2.5 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors">
              Mark as Published
            </button>
          )}
        </div>
      )}
    </MCCard>
  );
}
