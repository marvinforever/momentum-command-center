import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard } from "@/components/mc/Primitives";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateOptimization, generateThumbnails, fetchTranscriptFn } from "@/server/optimization.functions";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/optimization/new")({
  head: () => ({ meta: [{ title: "New Optimization — Momentum" }] }),
  component: NewOptimizationPage,
});

const OUTPUT_TYPES = [
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
  { key: "tags", label: "Tags" },
  { key: "pinned_comment", label: "Pinned Comment" },
  { key: "hook", label: "Hook (first 3s)" },
] as const;

const inputCls = "w-full rounded-lg border border-line bg-cream px-3 py-2.5 text-[13px] text-ink focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30 transition";

function NewOptimizationPage() {
  const [step, setStep] = useState(1);
  const [brandId, setBrandId] = useState("");
  const [videoId, setVideoId] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(OUTPUT_TYPES.map(t => t.key));
  const [generateThumbs, setGenerateThumbs] = useState(true);
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  const genOptFn = useServerFn(generateOptimization);
  const genThumbFn = useServerFn(generateThumbnails);
  const fetchTxFn = useServerFn(fetchTranscriptFn);

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("*").eq("status", "Active").order("name");
      return data ?? [];
    },
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["youtube-videos-for-brand", brandId],
    queryFn: async () => {
      if (!brandId) return [];
      const { data } = await supabase
        .from("youtube_videos")
        .select("id, youtube_video_id, current_title, current_thumbnail_url, views, optimization_status, published_at")
        .eq("brand_id", brandId)
        .order("published_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!brandId,
  });

  const { data: outputs = [] } = useQuery({
    queryKey: ["optimization-outputs", runId],
    queryFn: async () => {
      if (!runId) return [];
      const { data } = await supabase
        .from("optimization_outputs")
        .select("*")
        .eq("optimization_run_id", runId)
        .order("output_type")
        .order("variant_index");
      return data ?? [];
    },
    enabled: !!runId,
  });

  const { data: thumbnails = [] } = useQuery({
    queryKey: ["thumbnail-generations", runId],
    queryFn: async () => {
      if (!runId) return [];
      const { data } = await supabase
        .from("thumbnail_generations")
        .select("*")
        .eq("optimization_run_id", runId)
        .order("variant_index");
      return data ?? [];
    },
    enabled: !!runId,
  });

  const selectedVideo = videos.find((v: any) => v.id === videoId);

  // Resolve a pasted YouTube URL to an existing video or create one
  async function resolveVideo() {
    if (!pasteUrl.trim()) return;
    // Extract video ID from URL
    const match = pasteUrl.match(/(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    const extId = match?.[1] ?? pasteUrl.trim();

    // Check if already in DB
    const { data: existing } = await supabase.from("youtube_videos").select("id").eq("youtube_video_id", extId).maybeSingle();
    if (existing) {
      setVideoId(existing.id);
      setPasteUrl("");
      setStep(3);
      return;
    }

    // Create a new youtube_videos row
    const { data: newVid, error } = await supabase.from("youtube_videos").insert({
      youtube_video_id: extId,
      brand_id: brandId,
      current_title: `Video ${extId}`,
      optimization_status: "untouched",
    }).select("id").single();

    if (error) { toast.error(error.message); return; }
    setVideoId(newVid.id);
    setPasteUrl("");
    setStep(3);
  }

  async function handleGenerate() {
    if (!videoId || !brandId || selectedTypes.length === 0) {
      toast.error("Please select a brand, video, and at least one output type.");
      return;
    }
    setLoading(true);
    try {
      // First fetch transcript
      const video = videos.find((v: any) => v.id === videoId);
      if (video) {
        toast.info("Fetching transcript...");
        await fetchTxFn({ data: { youtubeVideoId: videoId, externalVideoId: video.youtube_video_id } });
      }

      toast.info("Generating optimizations with Claude...");
      const result = await genOptFn({
        data: { youtubeVideoId: videoId, brandId, outputTypes: selectedTypes },
      });

      if (result.error) {
        toast.error(`Generation failed: ${result.error}`);
        return;
      }

      setRunId(result.runId);

      // Generate thumbnails if requested
      if (generateThumbs) {
        toast.info("Generating thumbnails...");
        await genThumbFn({
          data: { optimizationRunId: result.runId, youtubeVideoId: videoId, brandId },
        });
      }

      qc.invalidateQueries({ queryKey: ["optimization-outputs"] });
      qc.invalidateQueries({ queryKey: ["thumbnail-generations"] });
      toast.success("Generation complete!");
      setStep(5);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    if (!runId) return;
    // Mark selected outputs
    for (const [type, outputId] of Object.entries(selections)) {
      await supabase.from("optimization_outputs").update({ selected_by_user: true, selected_at: new Date().toISOString() }).eq("id", outputId);
    }
    await supabase.from("optimization_runs").update({ status: "approved_by_user", approved_at: new Date().toISOString() }).eq("id", runId);
    await supabase.from("youtube_videos").update({ optimization_status: "optimization_approved" }).eq("id", videoId);
    toast.success("Saved as draft. Ready for review.");
    qc.invalidateQueries({ queryKey: ["optimization-runs"] });
  }

  // Group outputs by type
  const outputsByType: Record<string, any[]> = {};
  for (const o of outputs) {
    if (!outputsByType[o.output_type]) outputsByType[o.output_type] = [];
    outputsByType[o.output_type].push(o);
  }

  return (
    <PageShell>
      <PageHeader
        title="Optimize a Video"
        subtitle="Step-by-step AI optimization workflow"
        breadcrumbs={[
          { label: "Command Center", to: "/" },
          { label: "Optimization", to: "/admin/optimization" },
          { label: "New" },
        ]}
      />

      {/* Progress steps */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { n: 1, label: "Brand" },
          { n: 2, label: "Video" },
          { n: 3, label: "Options" },
          { n: 4, label: "Generate" },
          { n: 5, label: "Review" },
        ].map((s) => (
          <button
            key={s.n}
            onClick={() => s.n <= step && setStep(s.n)}
            className={cn(
              "px-4 py-2 rounded-lg text-[12px] font-medium transition-colors",
              step >= s.n ? "bg-gold text-white" : "bg-cream-deep text-ink-muted"
            )}
          >
            {s.n}. {s.label}
          </button>
        ))}
      </div>

      {/* Step 1: Select brand */}
      {step >= 1 && (
        <MCCard className="p-5 mb-4">
          <h3 className="serif text-[18px] text-ink mb-3">Step 1: Select Brand</h3>
          <select className={inputCls + " max-w-md"} value={brandId} onChange={(e) => { setBrandId(e.target.value); setVideoId(""); if (e.target.value) setStep(2); }}>
            <option value="">Choose brand…</option>
            {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </MCCard>
      )}

      {/* Step 2: Select video */}
      {step >= 2 && brandId && (
        <MCCard className="p-5 mb-4">
          <h3 className="serif text-[18px] text-ink mb-3">Step 2: Select Video</h3>

          <div className="mb-4">
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="Paste YouTube URL or video ID…"
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
              />
              <button onClick={resolveVideo} className="rounded-lg bg-gold px-4 py-2 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors whitespace-nowrap">
                Add
              </button>
            </div>
          </div>

          {videos.length > 0 && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {videos.map((v: any) => (
                <button
                  key={v.id}
                  onClick={() => { setVideoId(v.id); setStep(3); }}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                    videoId === v.id ? "bg-gold-bg border border-gold-soft" : "bg-cream hover:bg-cream-deep"
                  )}
                >
                  {v.current_thumbnail_url && (
                    <img src={v.current_thumbnail_url} alt="" className="w-20 h-12 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-ink truncate">{v.current_title ?? v.youtube_video_id}</p>
                    <p className="text-[11px] text-ink-muted">{v.views ?? 0} views · {v.optimization_status}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {videos.length === 0 && (
            <p className="text-[13px] text-ink-muted">No videos found for this brand. Paste a YouTube URL above to add one.</p>
          )}
        </MCCard>
      )}

      {/* Step 3: Select output types */}
      {step >= 3 && videoId && (
        <MCCard className="p-5 mb-4">
          <h3 className="serif text-[18px] text-ink mb-3">Step 3: What to Generate</h3>
          <div className="flex flex-wrap gap-3 mb-4">
            {OUTPUT_TYPES.map((t) => (
              <label key={t.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(t.key)}
                  onChange={(e) => setSelectedTypes(
                    e.target.checked ? [...selectedTypes, t.key] : selectedTypes.filter(s => s !== t.key)
                  )}
                  className="rounded border-line accent-gold"
                />
                <span className="text-[13px] text-ink">{t.label}</span>
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={generateThumbs}
              onChange={(e) => setGenerateThumbs(e.target.checked)}
              className="rounded border-line accent-gold"
            />
            <span className="text-[13px] text-ink">Generate Thumbnail Concepts + Images</span>
          </label>

          <div className="mt-4">
            <p className="text-[11px] text-ink-muted mb-3">Est. cost: $0.10–0.40 (text) + ${generateThumbs ? "0.15" : "0.00"} (thumbnails)</p>
            <button
              onClick={() => { setStep(4); handleGenerate(); }}
              disabled={loading || selectedTypes.length === 0}
              className="rounded-lg bg-gold px-6 py-2.5 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors disabled:opacity-60"
            >
              {loading ? "Generating…" : "Generate Options"}
            </button>
          </div>
        </MCCard>
      )}

      {/* Step 4: Loading state */}
      {step === 4 && loading && (
        <MCCard className="p-8 mb-4 text-center">
          <div className="mc-pulse">
            <p className="serif text-[22px] text-ink mb-2">Generating optimizations…</p>
            <p className="text-[13px] text-ink-muted">Claude is analyzing the video and brand voice. This takes 30-60 seconds.</p>
          </div>
        </MCCard>
      )}

      {/* Step 5: Review outputs */}
      {step >= 5 && runId && (
        <>
          {Object.entries(outputsByType).map(([type, variants]) => (
            <MCCard key={type} className="p-5 mb-4">
              <h3 className="serif text-[18px] text-ink mb-3 capitalize">{type.replace(/_/g, " ")} Options</h3>
              <div className="space-y-3">
                {variants.map((v: any) => (
                  <label
                    key={v.id}
                    className={cn(
                      "block p-4 rounded-lg border cursor-pointer transition-colors",
                      selections[type] === v.id ? "border-gold bg-gold-bg" : "border-line bg-cream hover:bg-cream-deep"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name={`select-${type}`}
                        checked={selections[type] === v.id}
                        onChange={() => setSelections(prev => ({ ...prev, [type]: v.id }))}
                        className="mt-1 accent-gold"
                      />
                      <div className="flex-1">
                        <p className="text-[13px] text-ink whitespace-pre-wrap">{v.content}</p>
                        <p className="text-[11px] text-ink-muted mt-2 italic">{v.rationale}</p>

                        {/* Score bars */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                          <ScoreBar label="Brand Voice" value={v.brand_voice_score} />
                          <ScoreBar label="Human" value={v.human_sounding_score} />
                          <ScoreBar label="Approval" value={v.approval_likelihood_score} />
                          <ScoreBar label="SEO" value={v.seo_score} />
                        </div>

                        {/* Warnings */}
                        {(v.guardrail_warnings as string[])?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(v.guardrail_warnings as string[]).map((w: string, i: number) => (
                              <span key={i} className="mc-tag bg-burgundy-bg text-burgundy">{w}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </MCCard>
          ))}

          {/* Thumbnails */}
          {thumbnails.length > 0 && (
            <MCCard className="p-5 mb-4">
              <h3 className="serif text-[18px] text-ink mb-3">Thumbnail Concepts</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {thumbnails.map((t: any) => (
                  <div key={t.id} className="rounded-lg border border-line overflow-hidden bg-cream">
                    {t.image_url ? (
                      <img src={t.image_url} alt={t.text_overlay ?? ""} className="w-full aspect-video object-cover" />
                    ) : (
                      <div className="w-full aspect-video bg-cream-deep flex items-center justify-center text-ink-muted text-[12px]">
                        No image generated
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-[13px] text-ink font-medium">{t.text_overlay ?? "(no overlay)"}</p>
                      <p className="text-[11px] text-ink-muted mt-1">{t.layout_notes}</p>
                    </div>
                  </div>
                ))}
              </div>
            </MCCard>
          )}

          {/* Side-by-side preview */}
          {selectedVideo && Object.keys(selections).length > 0 && (
            <MCCard className="p-5 mb-4">
              <h3 className="serif text-[18px] text-ink mb-3">Side-by-Side Preview</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-cream border border-line">
                  <p className="label-eyebrow mb-2">Current</p>
                  <p className="text-[14px] text-ink font-medium">{selectedVideo.current_title}</p>
                </div>
                <div className="p-4 rounded-lg bg-gold-bg border border-gold-soft">
                  <p className="label-eyebrow mb-2 text-gold">Proposed</p>
                  {selections["title"] && (
                    <p className="text-[14px] text-ink font-medium">
                      {outputs.find((o: any) => o.id === selections["title"])?.content ?? ""}
                    </p>
                  )}
                </div>
              </div>
            </MCCard>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mb-8">
            <button onClick={handleSaveDraft} className="rounded-lg bg-gold px-6 py-2.5 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors">
              Save as Draft
            </button>
            <Link to="/admin/optimization" className="rounded-lg border border-line bg-paper px-6 py-2.5 text-[13px] font-medium text-ink hover:bg-cream-deep transition-colors">
              Back to Dashboard
            </Link>
          </div>
        </>
      )}
    </PageShell>
  );
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0;
  const color = v >= 80 ? "bg-sage" : v >= 60 ? "bg-gold" : v >= 40 ? "bg-amber" : "bg-burgundy";
  return (
    <div>
      <div className="flex justify-between text-[10px] text-ink-muted mb-1">
        <span>{label}</span>
        <span>{v}</span>
      </div>
      <div className="h-1.5 bg-cream-deep rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
