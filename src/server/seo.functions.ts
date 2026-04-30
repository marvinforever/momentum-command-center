/**
 * SEO Research & Scoring — server function wrappers.
 * Safe to import from client components.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const zUuid = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid UUID format"
);

export const runKeywordResearchFn = createServerFn({ method: "POST" })
  .inputValidator((data: { youtubeVideoId: string; optimizationRunId?: string }) =>
    z.object({
      youtubeVideoId: zUuid,
      optimizationRunId: zUuid.optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { runKeywordResearch } = await import("./seo.server");
    return runKeywordResearch(data);
  });

export const runSeoScoreFn = createServerFn({ method: "POST" })
  .inputValidator((data: { youtubeVideoId: string; optimizationRunId?: string }) =>
    z.object({
      youtubeVideoId: zUuid,
      optimizationRunId: zUuid.optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { runSeoScore } = await import("./seo.server");
    return runSeoScore(data);
  });

export const runCompetitorAnalysisFn = createServerFn({ method: "POST" })
  .inputValidator((data: { optimizationRunId: string; targetKeywords: string[] }) =>
    z.object({
      optimizationRunId: zUuid,
      targetKeywords: z.array(z.string().min(1).max(200)).min(1).max(5),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { runCompetitorAnalysis } = await import("./seo.server");
    return runCompetitorAnalysis(data);
  });

export const runKeywordRankingCheckFn = createServerFn({ method: "POST" })
  .inputValidator((data: { limit?: number }) =>
    z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(data)
  )
  .handler(async ({ data }) => {
    const { runKeywordRankingCheck } = await import("./seo.server");
    return runKeywordRankingCheck(data);
  });

export const getQuotaUsageFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getQuotaUsage } = await import("./seo.server");
    return getQuotaUsage();
  });

export const setTargetKeywordsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { youtubeVideoId: string; keywordIds: string[] }) =>
    z.object({
      youtubeVideoId: zUuid,
      keywordIds: z.array(zUuid).min(1).max(10),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    // Reset all to false
    await sb.from("seo_keyword_research")
      .update({ is_target: false })
      .eq("youtube_video_id", data.youtubeVideoId);
    // Set selected to true
    for (const id of data.keywordIds) {
      await sb.from("seo_keyword_research")
        .update({ is_target: true })
        .eq("id", id);
    }
    return { success: true };
  });
