import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard } from "@/components/mc/Primitives";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateOptimization, generateThumbnails, fetchTranscriptFn } from "@/server/optimization.functions";
import { runKeywordResearchFn, runSeoScoreFn, runCompetitorAnalysisFn, setTargetKeywordsFn, getQuotaUsageFn } from "@/server/seo.functions";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

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
  const [useResearch, setUseResearch] = useState(true);
  const [loading, setLoading] = useState(false);
  const [researchLoading, setResearchLoading] = useState(false);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);
  const [competitorPatterns, setCompetitorPatterns] = useState<any>(null);
  const qc = useQueryClient();

  const genOptFn = useServerFn(generateOptimization);
  const genThumbFn = useServerFn(generateThumbnails);
  const fetchTxFn = useServerFn(fetchTranscriptFn);
  const kwResearchFn = useServerFn(runKeywordResearchFn);
  const seoScoreFn = useServerFn(runSeoScoreFn);
  const competitorFn = useServerFn(runCompetitorAnalysisFn);
  const setTargetsFn = useServerFn(setTargetKeywordsFn);
  const quotaFn = useServerFn(getQuotaUsageFn);

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

  const { data: keywords = [] } = useQuery({
    queryKey: ["seo-keywords", videoId],
    queryFn: async () => {
      if (!videoId) return [];
      const { data } = await (supabase as any)
        .from("seo_keyword_research")
        .select("*")
        .eq("youtube_video_id", videoId)
        .order("relevance_score", { ascending: false });
      return data ?? [];
    },
    enabled: !!videoId,
  });

  const { data: seoScore } = useQuery({
    queryKey: ["seo-score", videoId],
    queryFn: async () => {
      if (!videoId) return null;
      const { data } = await (supabase as any)
        .from("video_seo_scores")
        .select("*")
        .eq("youtube_video_id", videoId)
        .order("scored_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
    enabled: !!videoId,
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

  const { data: quota } = useQuery({
    queryKey: ["yt-quota"],
    queryFn: () => quotaFn(),
  });

  const selectedVideo = videos.find((v: any) => v.id === videoId);

  async function resolveVideo() {
    if (!pasteUrl.trim()) return;
    const match = pasteUrl.match(/(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    const extId = match?.[1] ?? pasteUrl.trim();
    const { data: existing } = await supabase.from("youtube_videos").select("id").eq("youtube_video_id", extId).maybeSingle();
    if (existing) {
      setVideoId(existing.id);
      setPasteUrl("");
      setStep(3);
      return;
    }
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

  async function handleResearch() {
    if (!videoId) return;
    setResearchLoading(true);
    try {
      // Fetch transcript first
      const video = videos.find((v: any) => v.id === videoId);
      if (video) {
        toast.info("Fetching transcript...");
        await fetchTxFn({ data: { youtubeVideoId: videoId, externalVideoId: video.youtube_video_id } });
      }
      toast.info("Researching keywords...");
      const result = await kwResearchFn({ data: { youtubeVideoId: videoId } });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Found ${result.keywords.length} keyword candidates`);
        qc.invalidateQueries({ queryKey: ["seo-keywords", videoId] });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResearchLoading(false);
    }
  }

  async function handleSeoScore() {
    if (!videoId) return;
    setScoreLoading(true);
    try {
      // Save target keywords first
      if (selectedKeywordIds.length > 0) {
        await setTargetsFn({ data: { youtubeVideoId: videoId, keywordIds: selectedKeywordIds } });
        qc.invalidateQueries({ queryKey: ["seo-keywords", videoId] });
      }
      const result = await seoScoreFn({ data: { youtubeVideoId: videoId } });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`SEO score: ${result.score?.overall_score}`);
        qc.invalidateQueries({ queryKey: ["seo-score", videoId] });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setScoreLoading(false);
    }
  }

  async function handleCompetitorAnalysis() {
    if (!videoId) return;
    setCompetitorLoading(true);
    try {
      const targetKws = keywords.filter((k: any) => selectedKeywordIds.includes(k.id) || k.is_target);
      if (targetKws.length === 0) {
        toast.error("Select target keywords first");
        return;
      }
      // We need an optimization_run_id — create a temporary one or use existing
      toast.info("Analyzing competitors...");
      const result = await competitorFn({
        data: {
          optimizationRunId: runId ?? "00000000-0000-0000-0000-000000000000",
          targetKeywords: targetKws.slice(0, 3).map((k: any) => k.keyword),
        },
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        setCompetitorPatterns(result.patterns);
        toast.success(`Analyzed ${result.competitors.length} competitor videos`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCompetitorLoading(false);
    }
  }

  async function handleGenerate() {
    if (!videoId || !brandId || selectedTypes.length === 0) {
      toast.error("Please select a brand, video, and at least one output type.");
      return;
    }
    setLoading(true);
    try {
      // Save target keywords if selected
      if (selectedKeywordIds.length > 0) {
        await setTargetsFn({ data: { youtubeVideoId: videoId, keywordIds: selectedKeywordIds } });
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

      if (generateThumbs) {
        toast.info("Generating thumbnails...");
        await genThumbFn({
          data: { optimizationRunId: result.runId, youtubeVideoId: videoId, brandId },
        });
      }

      qc.invalidateQueries({ queryKey: ["optimization-outputs"] });
      qc.invalidateQueries({ queryKey: ["thumbnail-generations"] });
      qc.invalidateQueries({ queryKey: ["yt-quota"] });
      toast.success("Generation complete!");
      setStep(8);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    if (!runId) return;
    for (const [_type, outputId] of Object.entries(selections)) {
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

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied. Paste into YouTube.");
    }).catch(() => {
      toast.error("Failed to copy");
    });
  }

  async function downloadImage(url: string, filename: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success("Thumbnail downloaded");
    } catch {
      toast.error("Failed to download");
    }
  }

  function copyEntirePackage() {
    const getSelected = (type: string) => outputs.find((o: any) => o.id === selections[type])?.content ?? "";
    const selectedThumb = thumbnails[0];
    const targetKwStr = keywords.filter((k: any) => k.is_target || selectedKeywordIds.includes(k.id)).map((k: any) => k.keyword).join(", ");

    const separator = "═══════════════════════════════════════";
    const pkg = [
      separator,
      "TITLE:",
      getSelected("title"),
      "",
      separator,
      "DESCRIPTION:",
      getSelected("description"),
      "",
      separator,
      "TAGS (paste into YouTube tag field):",
      getSelected("tags"),
      "",
      separator,
      "PINNED COMMENT (post after publishing):",
      getSelected("pinned_comment"),
      "",
      separator,
      "HOOK (first 3 seconds):",
      getSelected("hook"),
      "",
      separator,
      selectedThumb?.image_url ? `THUMBNAIL: download from ${selectedThumb.image_url}` : "THUMBNAIL: (none generated)",
      selectedThumb?.text_overlay ? `THUMBNAIL TEXT OVERLAY: ${selectedThumb.text_overlay}` : "",
      "",
      separator,
      "TARGET KEYWORDS (for reference):",
      targetKwStr || "(none selected)",
      "",
      separator,
      "PUBLISH CHECKLIST:",
      "☐ Title pasted in YouTube",
      "☐ Description pasted (with timestamps verified)",
      "☐ Tags pasted",
      "☐ Thumbnail uploaded",
      "☐ Pinned comment posted after publish",
      "☐ End screen elements reviewed",
      "☐ Cards added (optional)",
      "☐ Captions enabled",
      separator,
    ].join("\n");

    navigator.clipboard.writeText(pkg).then(() => {
      toast.success("Full package copied. Paste into YouTube Studio one section at a time.");
    }).catch(() => {
      toast.error("Failed to copy");
    });
  }

  const STEPS = [
    { n: 1, label: "Brand" },
    { n: 2, label: "Video" },
    { n: 3, label: "Research" },
    { n: 4, label: "SEO Score" },
    { n: 5, label: "Competitors" },
    { n: 6, label: "Options" },
    { n: 7, label: "Generate" },
    { n: 8, label: "Review" },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Optimize a Video"
        subtitle="Research-driven AI optimization workflow"
        breadcrumbs={[
          { label: "Command Center", to: "/" },
          { label: "Optimization", to: "/admin/optimization" },
          { label: "New" },
        ]}
      />

      {/* Quota bar */}
      {quota && (
        <div className="flex items-center gap-2 mb-4 text-[11px] text-ink-muted">
          <span>YouTube API:</span>
          <div className="h-1.5 w-24 bg-cream-deep rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full", quota.used / quota.limit > 0.8 ? "bg-burgundy" : "bg-gold")}
              style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }}
            />
          </div>
          <span>{quota.used.toLocaleString()} / {quota.limit.toLocaleString()} units</span>
        </div>
      )}

      {/* Progress steps */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {STEPS.map((s) => (
          <button
            key={s.n}
            onClick={() => s.n <= step && setStep(s.n)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
              step === s.n ? "bg-gold text-white" : step > s.n ? "bg-gold/20 text-gold" : "bg-cream-deep text-ink-muted"
            )}
          >
            {s.n}. {s.label}
          </button>
        ))}
      </div>

      {/* Step 1: Select brand */}
      {step >= 1 && (
        <MCCard className="p-5 mb-4">
          <h3 className="serif text-[18px] text-ink mb-3">1. Select Brand</h3>
          <select className={inputCls + " max-w-md"} value={brandId} onChange={(e) => { setBrandId(e.target.value); setVideoId(""); if (e.target.value) setStep(2); }}>
            <option value="">Choose brand…</option>
            {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </MCCard>
      )}

      {/* Step 2: Select video */}
      {step >= 2 && brandId && (
        <MCCard className="p-5 mb-4">
          <h3 className="serif text-[18px] text-ink mb-3">2. Select Video</h3>
          <div className="mb-4 flex gap-2">
            <input className={inputCls} placeholder="Paste YouTube URL or video ID…" value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)} />
            <button onClick={resolveVideo} className="rounded-lg bg-gold px-4 py-2 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors whitespace-nowrap">Add</button>
          </div>
          {videos.length > 0 && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {videos.map((v: any) => (
                <button key={v.id} onClick={() => { setVideoId(v.id); setStep(3); }} className={cn("w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors", videoId === v.id ? "bg-gold-bg border border-gold-soft" : "bg-cream hover:bg-cream-deep")}>
                  {v.current_thumbnail_url && <img src={v.current_thumbnail_url} alt="" className="w-20 h-12 rounded object-cover" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-ink truncate">{v.current_title ?? v.youtube_video_id}</p>
                    <p className="text-[11px] text-ink-muted">{v.views ?? 0} views · {v.optimization_status}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </MCCard>
      )}

      {/* Step 3: Keyword Research */}
      {step >= 3 && videoId && (
        <MCCard className="p-5 mb-4">
          <h3 className="serif text-[18px] text-ink mb-3">3. Research Keywords</h3>
          <p className="text-[12px] text-ink-muted mb-3">Discover what people search for related to this video's topic. Uses YouTube autocomplete (free) + search API.</p>
          <button onClick={handleResearch} disabled={researchLoading} className="rounded-lg bg-gold px-4 py-2 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors disabled:opacity-60 mb-4">
            {researchLoading ? "Researching…" : keywords.length > 0 ? "Re-run Research" : "Research Keywords"}
          </button>

          {keywords.length > 0 && (
            <>
              <p className="text-[12px] text-ink-muted mb-2">Select 3-5 target keywords:</p>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {keywords.map((kw: any) => (
                  <label key={kw.id} className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors", selectedKeywordIds.includes(kw.id) || kw.is_target ? "border-gold bg-gold-bg" : "border-line bg-cream hover:bg-cream-deep")}>
                    <input
                      type="checkbox"
                      checked={selectedKeywordIds.includes(kw.id) || kw.is_target}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedKeywordIds(prev => [...prev, kw.id]);
                        else setSelectedKeywordIds(prev => prev.filter(id => id !== kw.id));
                      }}
                      className="accent-gold"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-ink font-medium">{kw.keyword}</p>
                      <p className="text-[10px] text-ink-muted">{kw.source}</p>
                    </div>
                    <div className="flex gap-3 text-[10px]">
                      <div className="text-center">
                        <div className="text-ink-muted">Volume</div>
                        <BarMini value={kw.search_volume_estimate ?? 0} max={100} color="bg-gold" />
                      </div>
                      <div className="text-center">
                        <div className="text-ink-muted">Competition</div>
                        <BarMini value={kw.competition_score ?? 0} max={100} color="bg-burgundy" />
                      </div>
                      <div className="text-center">
                        <div className="text-ink-muted">Relevance</div>
                        <BarMini value={kw.relevance_score ?? 0} max={100} color="bg-sage" />
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <button onClick={() => setStep(4)} className="mt-4 rounded-lg bg-gold px-4 py-2 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors">
                Continue with {selectedKeywordIds.length || keywords.filter((k: any) => k.is_target).length} targets →
              </button>
            </>
          )}
        </MCCard>
      )}

      {/* Step 4: SEO Score */}
      {step >= 4 && videoId && (
        <MCCard className="p-5 mb-4">
          <h3 className="serif text-[18px] text-ink mb-3">4. Current SEO Score</h3>
          {!seoScore ? (
            <button onClick={handleSeoScore} disabled={scoreLoading} className="rounded-lg bg-gold px-4 py-2 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors disabled:opacity-60">
              {scoreLoading ? "Scoring…" : "Score Current SEO"}
            </button>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className={cn("text-[36px] font-bold", seoScore.overall_score >= 70 ? "text-sage" : seoScore.overall_score >= 40 ? "text-gold" : "text-burgundy")}>
                  {seoScore.overall_score}
                </div>
                <span className="text-[13px] text-ink-muted">/ 100 overall</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <ScoreBar label="Title" value={seoScore.title_score} />
                <ScoreBar label="Description" value={seoScore.description_score} />
                <ScoreBar label="Tags" value={seoScore.tags_score} />
                <ScoreBar label="Thumbnail" value={seoScore.thumbnail_score} />
                <ScoreBar label="Engagement" value={seoScore.engagement_signals_score} />
                <ScoreBar label="Metadata" value={seoScore.metadata_completeness_score} />
                <ScoreBar label="Keyword Align" value={seoScore.keyword_alignment_score} />
              </div>
              {(seoScore.issues as any[])?.length > 0 && (
                <div className="space-y-2">
                  <p className="label-eyebrow">Issues to Fix</p>
                  {(seoScore.issues as any[]).map((issue: any, i: number) => (
                    <div key={i} className={cn("p-3 rounded-lg border text-[12px]", issue.severity === "high" ? "border-burgundy/30 bg-burgundy/5" : issue.severity === "medium" ? "border-amber/30 bg-amber/5" : "border-line bg-cream")}>
                      <span className={cn("mc-tag mr-2", issue.severity === "high" ? "bg-burgundy-bg text-burgundy" : issue.severity === "medium" ? "bg-amber/20 text-amber" : "bg-cream-deep text-ink-muted")}>{issue.severity}</span>
                      <span className="text-ink">{issue.message}</span>
                      <p className="text-ink-muted mt-1 italic">→ {issue.fix}</p>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setStep(5)} className="mt-4 rounded-lg bg-gold px-4 py-2 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors">
                Continue →
              </button>
            </>
          )}
        </MCCard>
      )}

      {/* Step 5: Competitor Analysis */}
      {step >= 5 && videoId && (
        <MCCard className="p-5 mb-4">
          <h3 className="serif text-[18px] text-ink mb-3">5. Competitor Analysis</h3>
          <p className="text-[12px] text-ink-muted mb-3">See what the top-ranking videos for your target keywords look like.</p>
          {!competitorPatterns ? (
            <button onClick={handleCompetitorAnalysis} disabled={competitorLoading} className="rounded-lg bg-gold px-4 py-2 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors disabled:opacity-60">
              {competitorLoading ? "Analyzing…" : "Analyze Competitors"}
            </button>
          ) : (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 text-[13px] text-ink font-medium cursor-pointer hover:text-gold transition-colors">
                <span>▸ Competitor Patterns</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-2 text-[12px] text-ink">
                <p>Average title length: <strong>{competitorPatterns.avg_title_length}</strong> chars</p>
                <p>Start with question: <strong>{competitorPatterns.title_starts_with_question_pct}%</strong></p>
                <p>Include a number: <strong>{competitorPatterns.title_contains_number_pct}%</strong></p>
                <p>Avg description length: <strong>{competitorPatterns.avg_description_length}</strong> chars</p>
                <p>Median views: <strong>{(competitorPatterns.median_views ?? 0).toLocaleString()}</strong></p>
                {competitorPatterns.common_title_words?.length > 0 && (
                  <p>Common title words: {competitorPatterns.common_title_words.map((w: string) => <span key={w} className="mc-tag mr-1">{w}</span>)}</p>
                )}
                {competitorPatterns.common_tags?.length > 0 && (
                  <p>Common tags: {competitorPatterns.common_tags.slice(0, 8).map((t: string) => <span key={t} className="mc-tag mr-1">{t}</span>)}</p>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
          <button onClick={() => setStep(6)} className="mt-4 rounded-lg border border-line bg-paper px-4 py-2 text-[13px] font-medium text-ink hover:bg-cream-deep transition-colors">
            {competitorPatterns ? "Continue →" : "Skip & Continue →"}
          </button>
        </MCCard>
      )}

      {/* Step 6: Select output types */}
      {step >= 6 && videoId && (
        <MCCard className="p-5 mb-4">
          <h3 className="serif text-[18px] text-ink mb-3">6. What to Generate</h3>
          <div className="flex flex-wrap gap-3 mb-4">
            {OUTPUT_TYPES.map((t) => (
              <label key={t.key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selectedTypes.includes(t.key)} onChange={(e) => setSelectedTypes(e.target.checked ? [...selectedTypes, t.key] : selectedTypes.filter(s => s !== t.key))} className="rounded border-line accent-gold" />
                <span className="text-[13px] text-ink">{t.label}</span>
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" checked={generateThumbs} onChange={(e) => setGenerateThumbs(e.target.checked)} className="rounded border-line accent-gold" />
            <span className="text-[13px] text-ink">Generate Thumbnail Concepts</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useResearch} onChange={(e) => setUseResearch(e.target.checked)} className="rounded border-line accent-gold" />
            <span className="text-[13px] text-ink">Use keyword research above (recommended)</span>
          </label>
          <div className="mt-4">
            <p className="text-[11px] text-ink-muted mb-3">Est. cost: $0.10–0.40 (text) + ${generateThumbs ? "0.15" : "0.00"} (thumbnails)</p>
            <button
              onClick={() => { setStep(7); handleGenerate(); }}
              disabled={loading || selectedTypes.length === 0}
              className="rounded-lg bg-gold px-6 py-2.5 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors disabled:opacity-60"
            >
              {loading ? "Generating…" : "Generate Options"}
            </button>
          </div>
        </MCCard>
      )}

      {/* Step 7: Loading */}
      {step === 7 && loading && (
        <MCCard className="p-8 mb-4 text-center">
          <div className="mc-pulse">
            <p className="serif text-[22px] text-ink mb-2">Generating optimizations…</p>
            <p className="text-[13px] text-ink-muted">Claude is analyzing the video, keywords, and competitor patterns. This takes 30-60 seconds.</p>
          </div>
        </MCCard>
      )}

      {/* Step 8: Review */}
      {step >= 8 && runId && (
        <>
          {Object.entries(outputsByType).map(([type, variants]) => (
            <MCCard key={type} className="p-5 mb-4">
              <h3 className="serif text-[18px] text-ink mb-3 capitalize">{type.replace(/_/g, " ")} Options</h3>
              <div className="space-y-3">
                {variants.map((v: any) => {
                  const currentOverall = seoScore?.overall_score ?? 0;
                  const predicted = predictClientSeoScore(type, v.content ?? "", keywords.filter((k: any) => k.is_target).map((k: any) => k.keyword), currentOverall);

                  return (
                    <label key={v.id} className={cn("block p-4 rounded-lg border cursor-pointer transition-colors relative", selections[type] === v.id ? "border-gold bg-gold-bg" : "border-line bg-cream hover:bg-cream-deep")}>
                      {/* Copy button */}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyToClipboard(v.content ?? ""); }}
                        className="absolute top-3 right-3 rounded-md bg-gold/90 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-gold transition-colors z-10"
                      >
                        Copy
                      </button>
                      <div className="flex items-start gap-3">
                        <input type="radio" name={`select-${type}`} checked={selections[type] === v.id} onChange={() => setSelections(prev => ({ ...prev, [type]: v.id }))} className="mt-1 accent-gold" />
                        <div className="flex-1 pr-16">
                          {/* Content display */}
                          <div className="text-[13px] text-ink whitespace-pre-wrap leading-relaxed font-mono bg-paper/50 rounded p-3 border border-line/50">
                            {v.content}
                          </div>
                          <p className="text-[11px] text-ink-muted mt-2 italic">{v.rationale}</p>

                          {/* Component toggle for descriptions */}
                          {type === "description" && v.content_json && (
                            <DescriptionComponents contentJson={v.content_json} />
                          )}

                          {/* SEO delta */}
                          {currentOverall > 0 && (
                            <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium">
                              <span className="text-ink-muted">Predicted SEO:</span>
                              <span className={currentOverall < predicted ? "text-sage" : "text-ink-muted"}>
                                {currentOverall} → {predicted}
                              </span>
                              {predicted > currentOverall && <span className="text-sage">▲ +{predicted - currentOverall}</span>}
                            </div>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                            <ScoreBar label="Brand Voice" value={v.brand_voice_score} />
                            <ScoreBar label="Human" value={v.human_sounding_score} />
                            <ScoreBar label="Approval" value={v.approval_likelihood_score} />
                            <ScoreBar label="SEO" value={v.seo_score} />
                          </div>

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
                  );
                })}
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
                      <div className="w-full aspect-video bg-cream-deep flex items-center justify-center text-ink-muted text-[12px]">No image</div>
                    )}
                    <div className="p-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] text-ink font-medium">{t.text_overlay ?? "(no overlay)"}</p>
                        <p className="text-[11px] text-ink-muted mt-1">{t.layout_notes}</p>
                      </div>
                      {t.image_url && (
                        <button
                          onClick={() => downloadImage(t.image_url, `thumbnail_v${t.variant_index}.png`)}
                          className="rounded-md bg-gold/90 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-gold transition-colors whitespace-nowrap"
                        >
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </MCCard>
          )}

          {/* Side-by-side */}
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
                    <p className="text-[14px] text-ink font-medium">{outputs.find((o: any) => o.id === selections["title"])?.content ?? ""}</p>
                  )}
                </div>
              </div>
            </MCCard>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mb-8">
            {Object.keys(selections).length > 0 && (
              <button
                onClick={() => copyEntirePackage()}
                className="rounded-lg bg-ink px-6 py-2.5 text-[13px] font-medium text-white hover:bg-ink/90 transition-colors"
              >
                📋 Copy Entire Optimized Package
              </button>
            )}
            <button onClick={handleSaveDraft} className="rounded-lg bg-gold px-6 py-2.5 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors">Save as Draft</button>
            <Link to="/admin/optimization" className="rounded-lg border border-line bg-paper px-6 py-2.5 text-[13px] font-medium text-ink hover:bg-cream-deep transition-colors">Back to Dashboard</Link>
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

function BarMini({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="w-16 h-1.5 bg-cream-deep rounded-full overflow-hidden mt-0.5">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

function predictClientSeoScore(outputType: string, content: string, targetKeywords: string[], currentScore: number): number {
  const lower = content.toLowerCase();
  let predicted = currentScore;
  if (outputType === "title") {
    if (content.length >= 60 && content.length <= 70) predicted += 5;
    if (targetKeywords.some(kw => lower.includes(kw.toLowerCase()))) predicted += 15;
    if (/\d/.test(content)) predicted += 5;
  } else if (outputType === "description") {
    if (content.length >= 250) predicted += 10;
    if (targetKeywords.some(kw => lower.slice(0, 25).includes(kw.toLowerCase()))) predicted += 15;
  } else if (outputType === "tags") {
    const tagArr = content.split(",").map(t => t.trim());
    if (tagArr.length >= 5 && tagArr.length <= 15) predicted += 10;
    if (targetKeywords.some(kw => tagArr.some(t => t.toLowerCase().includes(kw.toLowerCase())))) predicted += 15;
  }
  return Math.min(100, Math.max(0, Math.round(predicted)));
}

function DescriptionComponents({ contentJson }: { contentJson: any }) {
  const [show, setShow] = useState(false);
  if (!contentJson) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShow(!show); }}
        className="text-[11px] text-gold hover:text-gold/80 font-medium transition-colors"
      >
        {show ? "▾ Hide components" : "▸ Show components"}
      </button>
      {show && (
        <div className="mt-2 space-y-2 text-[11px] border-t border-line pt-2">
          {contentJson.hook_line && (
            <div><span className="text-ink-muted font-medium">Hook line:</span> <span className="text-ink">{contentJson.hook_line}</span></div>
          )}
          {contentJson.body && (
            <div><span className="text-ink-muted font-medium">Body:</span> <span className="text-ink">{contentJson.body.slice(0, 200)}…</span></div>
          )}
          {contentJson.timestamps?.length > 0 && (
            <div>
              <span className="text-ink-muted font-medium">Timestamps:</span>
              <div className="ml-2 text-ink">{contentJson.timestamps.map((t: any, i: number) => <div key={i}>{t.time} — {t.label}</div>)}</div>
            </div>
          )}
          {contentJson.cta_block && (
            <div><span className="text-ink-muted font-medium">CTA:</span> <span className="text-ink">{contentJson.cta_block}</span></div>
          )}
          {contentJson.hashtags?.length > 0 && (
            <div><span className="text-ink-muted font-medium">Hashtags:</span> <span className="text-ink">{contentJson.hashtags.map((h: string) => `#${h}`).join(" ")}</span></div>
          )}
        </div>
      )}
    </div>
  );
}
