/**
 * YouTube Optimization — server function wrappers.
 * Safe to import from client components; the build replaces with RPC stubs.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const generateOptimization = createServerFn({ method: "POST" })
  .inputValidator((data: {
    youtubeVideoId: string;
    brandId: string;
    outputTypes: string[];
    triggeredBy?: string;
  }) => z.object({
    youtubeVideoId: z.string().uuid(),
    brandId: z.string().uuid(),
    outputTypes: z.array(z.string().min(1).max(50)).min(1).max(10),
    triggeredBy: z.string().max(255).optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { runOptimizationGenerate } = await import("./optimization.server");
    return runOptimizationGenerate({
      youtubeVideoId: data.youtubeVideoId,
      brandId: data.brandId,
      outputTypes: data.outputTypes as any[],
      triggeredBy: data.triggeredBy,
    });
  });

export const generateThumbnails = createServerFn({ method: "POST" })
  .inputValidator((data: {
    optimizationRunId: string;
    youtubeVideoId: string;
    brandId: string;
  }) => z.object({
    optimizationRunId: z.string().uuid(),
    youtubeVideoId: z.string().uuid(),
    brandId: z.string().uuid(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { runThumbnailGenerate } = await import("./optimization.server");
    return runThumbnailGenerate(data);
  });

export const buildAuditQueueFn = createServerFn({ method: "POST" })
  .inputValidator((data: { brandId?: string }) => z.object({
    brandId: z.string().uuid().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { buildAuditQueue } = await import("./optimization.server");
    return buildAuditQueue(data.brandId);
  });

export const fetchTranscriptFn = createServerFn({ method: "POST" })
  .inputValidator((data: {
    youtubeVideoId: string;
    externalVideoId: string;
  }) => z.object({
    youtubeVideoId: z.string().uuid(),
    externalVideoId: z.string().min(1).max(50),
  }).parse(data))
  .handler(async ({ data }) => {
    const { fetchTranscript } = await import("./optimization.server");
    return fetchTranscript(data.youtubeVideoId, data.externalVideoId);
  });

export const bootstrapVoiceFn = createServerFn({ method: "POST" })
  .inputValidator((data: { brandId: string }) => z.object({
    brandId: z.string().uuid(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { bootstrapVoiceFromContent } = await import("./optimization.server");
    return bootstrapVoiceFromContent(data.brandId);
  });

export const getMonthlyCostFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getMonthlyCostSummary } = await import("./optimization.server");
    return getMonthlyCostSummary();
  });
