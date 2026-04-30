/**
 * YouTube Optimization Engine — server-only helpers.
 * Uses Anthropic Claude for content generation and Lovable AI for thumbnail images.
 * NEVER import this from client code.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- Types ----------
interface BrandVoice {
  voice_summary: string;
  tone_descriptors: string[];
  banned_phrases: string[];
  approved_title_examples: any[];
  rejected_title_examples: any[];
  approved_description_examples: any[];
  audience_profile: string;
  thumbnail_style_rules: string;
}

interface VideoContext {
  id: string;
  youtube_video_id: string;
  current_title: string;
  current_description: string;
  current_tags: string[];
  transcript: string | null;
  views: number;
  impressions: number;
  ctr: number | null;
}

type OutputType = "title" | "description" | "tags" | "pinned_comment" | "hook" | "thumbnail_concept" | "thumbnail_text" | "hashtags";

// ---------- Anthropic Claude helpers ----------
async function callClaude(systemPrompt: string, userPrompt: string): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API error ${res.status}: ${errText}`);
  }

  const data = await res.json() as any;
  const text = data.content?.[0]?.text ?? "";
  return {
    text,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

function computeCost(inputTokens: number, outputTokens: number): number {
  // Claude Sonnet 4 pricing: $3/M input, $15/M output
  return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
}

// ---------- Brand voice loader ----------
async function loadBrandVoice(brandId: string): Promise<BrandVoice> {
  const { data } = await supabaseAdmin
    .from("brand_voice_profiles")
    .select("*")
    .eq("brand_id", brandId)
    .limit(1)
    .single();

  if (!data) throw new Error(`No voice profile for brand ${brandId}`);
  return {
    voice_summary: data.voice_summary ?? "",
    tone_descriptors: (data.tone_descriptors as string[]) ?? [],
    banned_phrases: (data.banned_phrases as string[]) ?? [],
    approved_title_examples: (data.approved_title_examples as any[]) ?? [],
    rejected_title_examples: (data.rejected_title_examples as any[]) ?? [],
    approved_description_examples: (data.approved_description_examples as any[]) ?? [],
    audience_profile: data.audience_profile ?? "",
    thumbnail_style_rules: data.thumbnail_style_rules ?? "",
  };
}

// ---------- Recent feedback loader ----------
async function loadRecentFeedback(brandId: string, limit = 10): Promise<string> {
  const { data } = await supabaseAdmin
    .from("approval_feedback")
    .select("output_type, output_content, rating, reason")
    .eq("brand_id", brandId)
    .order("rated_at", { ascending: false })
    .limit(limit);

  if (!data?.length) return "No prior feedback yet.";
  return data.map((f: any) => `- ${f.rating.toUpperCase()} (${f.output_type}): "${f.output_content?.slice(0, 100)}" — Reason: ${f.reason ?? "none given"}`).join("\n");
}

// ---------- Guardrail checks ----------
function runGuardrails(content: string, bannedPhrases: string[]): { passed: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const lower = content.toLowerCase();

  for (const phrase of bannedPhrases) {
    if (lower.includes(phrase.toLowerCase())) {
      warnings.push(`Contains banned phrase: "${phrase}"`);
    }
  }

  // Clickbait detection
  const clickbaitPatterns = [/you won't believe/i, /shocking/i, /this one trick/i, /doctors hate/i];
  for (const pat of clickbaitPatterns) {
    if (pat.test(content)) {
      warnings.push("Potential clickbait detected");
      break;
    }
  }

  return { passed: warnings.length === 0, warnings };
}

// ---------- Core optimization generate ----------
export async function runOptimizationGenerate(params: {
  youtubeVideoId: string; // our uuid
  brandId: string;
  outputTypes: OutputType[];
  triggeredBy?: string;
}): Promise<{ runId: string; error?: string }> {
  const startMs = Date.now();

  // Load video
  const { data: video } = await supabaseAdmin
    .from("youtube_videos")
    .select("*")
    .eq("id", params.youtubeVideoId)
    .single();
  if (!video) throw new Error("Video not found");

  // Load transcript
  const { data: transcriptRow } = await supabaseAdmin
    .from("video_transcripts")
    .select("transcript_text")
    .eq("youtube_video_id", params.youtubeVideoId)
    .limit(1)
    .maybeSingle();

  // Load brand
  const { data: brand } = await supabaseAdmin
    .from("brands")
    .select("name")
    .eq("id", params.brandId)
    .single();

  const voice = await loadBrandVoice(params.brandId);
  const recentFeedback = await loadRecentFeedback(params.brandId);

  // Create the optimization run
  const { data: run } = await supabaseAdmin
    .from("optimization_runs")
    .insert({
      youtube_video_id: params.youtubeVideoId,
      brand_id: params.brandId,
      triggered_by_user: params.triggeredBy ?? "system",
      trigger_type: "manual",
      status: "pending",
      input_summary: `Types: ${params.outputTypes.join(", ")}`,
    })
    .select("id")
    .single();

  if (!run) throw new Error("Failed to create optimization run");

  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    const transcript = transcriptRow?.transcript_text?.slice(0, 3000) ?? "(No transcript available)";

    // --- Load SEO research context ---
    const sb = supabaseAdmin as any;
    let seoContext = "";
    let targetKeywords: string[] = [];
    let currentSeoScore = 0;

    const { data: seoKws } = await sb
      .from("seo_keyword_research")
      .select("keyword, search_volume_estimate, competition_score, relevance_score, is_target")
      .eq("youtube_video_id", params.youtubeVideoId)
      .order("relevance_score", { ascending: false })
      .limit(10);

    if (seoKws?.length) {
      const targets = seoKws.filter((k: any) => k.is_target);
      const topKws = targets.length > 0 ? targets : seoKws.slice(0, 5);
      targetKeywords = topKws.map((k: any) => k.keyword);
      seoContext += `\nTARGET KEYWORDS (sorted by priority):\n`;
      for (const k of topKws) {
        seoContext += `- "${k.keyword}" (volume: ${k.search_volume_estimate ?? "?"}, competition: ${k.competition_score ?? "?"}, relevance: ${k.relevance_score ?? "?"})\n`;
      }
    }

    const { data: seoScores } = await sb
      .from("video_seo_scores")
      .select("overall_score, issues")
      .eq("youtube_video_id", params.youtubeVideoId)
      .order("scored_at", { ascending: false })
      .limit(1);

    if (seoScores?.length) {
      currentSeoScore = seoScores[0].overall_score ?? 0;
      if (seoScores[0].issues?.length) {
        seoContext += `\nCURRENT SEO ISSUES TO FIX:\n`;
        for (const issue of seoScores[0].issues.slice(0, 8)) {
          seoContext += `- [${issue.severity}] ${issue.message} → Fix: ${issue.fix}\n`;
        }
      }
    }

    const { data: compPatterns } = await sb
      .from("seo_competitor_videos")
      .select("title_length, title_starts_with_question, title_contains_number, description_length, tag_count")
      .eq("optimization_run_id", run.id)
      .limit(30);

    if (compPatterns?.length > 3) {
      const avgTitleLen = Math.round(compPatterns.reduce((s: number, c: any) => s + (c.title_length ?? 0), 0) / compPatterns.length);
      const questionPct = Math.round(compPatterns.filter((c: any) => c.title_starts_with_question).length / compPatterns.length * 100);
      const numberPct = Math.round(compPatterns.filter((c: any) => c.title_contains_number).length / compPatterns.length * 100);
      seoContext += `\nCOMPETITOR PATTERNS:\n- Average title length: ${avgTitleLen} chars\n- ${questionPct}% start with a question\n- ${numberPct}% include a number\n`;
    }

    // --- Load brand resource links & description template ---
    const { data: resourceLinks } = await (sb as any)
      .from("brand_resource_links")
      .select("link_label, url, category")
      .eq("brand_id", params.brandId)
      .eq("is_active", true)
      .order("display_order");

    const { data: voiceProfile } = await sb
      .from("brand_voice_profiles")
      .select("description_template")
      .eq("brand_id", params.brandId)
      .limit(1)
      .maybeSingle();

    const descTemplate = (voiceProfile as any)?.description_template ?? `{HOOK_LINE}\n\n{BODY}\n\n📌 In this video:\n{TIMESTAMPS}\n\n{CTA_BLOCK}\n\n🔗 Resources:\n{RESOURCE_LINKS}\n\n{HASHTAGS}`;

    // Load transcript segments for timestamps
    const { data: transcriptFull } = await supabaseAdmin
      .from("video_transcripts")
      .select("segments")
      .eq("youtube_video_id", params.youtubeVideoId)
      .maybeSingle();

    const hasSegments = transcriptFull?.segments && Array.isArray(transcriptFull.segments) && transcriptFull.segments.length > 10;

    // Build resource links string
    const resourceLinksStr = (resourceLinks ?? []).map((l: any) => `• ${l.link_label}: ${l.url}`).join("\n");
    const primaryCta = (resourceLinks ?? []).find((l: any) => l.category === "offer");

    for (const outputType of params.outputTypes) {
      if (outputType === "thumbnail_concept" || outputType === "thumbnail_text") continue;

      const systemPrompt = `You are a YouTube content optimization expert working for the brand "${brand?.name ?? "Unknown"}".
You generate high-quality, brand-aligned ${outputType}s for YouTube videos.
You MUST return valid JSON only. No preamble, no explanation outside JSON.`;

      let typeInstructions = "";
      if (outputType === "description") {
        typeInstructions = `Generate a PASTE-READY YouTube description with these components:
- "hook_line": One compelling line (≤120 chars) containing the primary target keyword. This is the first thing viewers see.
- "body": 2-3 paragraphs (150-250 words) woven with target keywords, in brand voice. No markdown formatting.
- "timestamps": An array of 5-8 chapter timestamps. Format each as {"time": "0:00", "label": "Chapter title"}.${hasSegments ? " Use real segment data to infer topic changes." : " Generate plausible timestamps based on typical video structure (mark as drafts)."}
- "cta_block": A single warm sentence + CTA.${primaryCta ? ` Include: ${primaryCta.url}` : ""}
- "hashtags": Array of 3-5 hashtags from target keywords (just the words, I'll add #).
- "rationale": One-sentence rationale.
- "brand_voice_score", "human_sounding_score", "approval_likelihood_score", "seo_score": 0-100
- "warnings": string array

Return as JSON array of 3 options: [{"hook_line": "...", "body": "...", "timestamps": [{"time":"0:00","label":"..."}], "cta_block": "...", "hashtags": ["word1","word2"], "rationale": "...", "brand_voice_score": N, ...}]`;
      } else if (outputType === "tags") {
        typeInstructions = `For tags, "content" should be a comma-separated list of 8-15 tags ready to paste into YouTube's tag field. Mix broad and long-tail. Include target keywords and brand name.`;
      } else if (outputType === "title") {
        typeInstructions = `Title should be under 70 characters. Engaging but not clickbait.`;
      } else if (outputType === "pinned_comment") {
        typeInstructions = `Write a warm, engaging pinned comment that drives discussion. 2-4 sentences. Ready to paste as-is.`;
      } else if (outputType === "hook") {
        typeInstructions = `Write the first 3 sentences/hook of the video that grabs attention in the first 5 seconds.`;
      }

      const userPrompt = `BRAND VOICE:
${voice.voice_summary}

TONE: ${voice.tone_descriptors.join(", ")}

NEVER use these phrases (auto-rejection): ${voice.banned_phrases.join(", ")}

AUDIENCE: ${voice.audience_profile}

EXAMPLES OF APPROVED ${outputType.toUpperCase()}S:
${JSON.stringify(voice.approved_title_examples.slice(0, 5))}

EXAMPLES OF REJECTED ${outputType.toUpperCase()}S:
${JSON.stringify(voice.rejected_title_examples.slice(0, 5))}

RECENT FEEDBACK FROM CHRISTINE:
${recentFeedback}

VIDEO TRANSCRIPT:
${transcript}

CURRENT TITLE: ${video.current_title ?? "(none)"}
CURRENT DESCRIPTION: ${(video.current_description ?? "(none)").slice(0, 500)}
CURRENT TAGS: ${JSON.stringify(video.current_tags ?? [])}
${seoContext}
${typeInstructions}
${targetKeywords.length > 0 ? `\nIMPORTANT: Naturally include the top 2 target keywords: "${targetKeywords.slice(0, 2).join('", "')}". Address the SEO issues listed above.` : ""}
${outputType !== "description" ? `\nGenerate 5 options. Return as JSON array: [{"content": "...", "rationale": "...", "brand_voice_score": N, "human_sounding_score": N, "approval_likelihood_score": N, "seo_score": N, "warnings": []}]` : ""}`;

      const result = await callClaude(systemPrompt, userPrompt);
      totalCost += computeCost(result.inputTokens, result.outputTokens);
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;

      // Parse JSON from Claude response
      let variants: any[] = [];
      try {
        const jsonMatch = result.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          variants = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.error(`Failed to parse Claude response for ${outputType}:`, result.text.slice(0, 200));
        continue;
      }

      // For descriptions, assemble the paste-ready string
      if (outputType === "description") {
        for (const v of variants) {
          const hookLine = v.hook_line ?? "";
          const body = v.body ?? v.content ?? "";
          const timestamps = (v.timestamps ?? []).map((t: any) => `${t.time} — ${t.label}`).join("\n");
          const ctaBlock = v.cta_block ?? "";
          const hashtags = (v.hashtags ?? []).map((h: string) => `#${h.replace(/^#/, "")}`).join(" ");

          const assembled = descTemplate
            .replace("{HOOK_LINE}", hookLine)
            .replace("{BODY}", body)
            .replace("{TIMESTAMPS}", timestamps || "(timestamps to be added)")
            .replace("{CTA_BLOCK}", ctaBlock)
            .replace("{RESOURCE_LINKS}", resourceLinksStr || "(no resource links)")
            .replace("{HASHTAGS}", hashtags);

          v.content = assembled;
          v.content_json = {
            hook_line: hookLine,
            body,
            timestamps: v.timestamps ?? [],
            cta_block: ctaBlock,
            resource_links: (resourceLinks ?? []).map((l: any) => ({ label: l.link_label, url: l.url })),
            hashtags: v.hashtags ?? [],
            assembled_full_text: assembled,
          };
        }
      }

      // Run guardrails and re-score, then take top 3
      const scored = variants.map((v: any) => {
        const content = v.content ?? "";
        const guardrails = runGuardrails(content, voice.banned_phrases);
        return {
          ...v,
          passed_guardrails: guardrails.passed,
          guardrail_warnings: [...(v.warnings ?? []), ...guardrails.warnings],
          composite: (
            (v.brand_voice_score ?? 50) * 0.35 +
            (v.human_sounding_score ?? 50) * 0.20 +
            (v.approval_likelihood_score ?? 50) * 0.30 +
            (v.seo_score ?? 50) * 0.15
          ) * (guardrails.passed ? 1 : 0.5),
        };
      });

      scored.sort((a: any, b: any) => b.composite - a.composite);
      const top3 = scored.slice(0, 3);

      // Insert into optimization_outputs
      for (let i = 0; i < top3.length; i++) {
        const v = top3[i];
        await supabaseAdmin.from("optimization_outputs").insert({
          optimization_run_id: run.id,
          output_type: outputType,
          variant_index: i + 1,
          content: v.content ?? "",
          content_json: v.content_json ?? (outputType === "tags" ? { tags: (v.content ?? "").split(",").map((t: string) => t.trim()) } : null),
          rationale: v.rationale ?? "",
          brand_voice_score: v.brand_voice_score ?? null,
          human_sounding_score: v.human_sounding_score ?? null,
          approval_likelihood_score: v.approval_likelihood_score ?? null,
          seo_score: v.seo_score ?? null,
          passed_guardrails: v.passed_guardrails,
          guardrail_warnings: v.guardrail_warnings,
        });
      }
    }

    const latencyMs = Date.now() - startMs;

    // Update the run
    await supabaseAdmin
      .from("optimization_runs")
      .update({
        status: "completed",
        cost_usd: totalCost,
        latency_ms: latencyMs,
        raw_output: { totalInputTokens, totalOutputTokens },
      })
      .eq("id", run.id);

    // Update video status
    await supabaseAdmin
      .from("youtube_videos")
      .update({ optimization_status: "optimization_pending" })
      .eq("id", params.youtubeVideoId);

    return { runId: run.id };
  } catch (err: any) {
    await supabaseAdmin
      .from("optimization_runs")
      .update({ status: "failed", error: err.message, cost_usd: totalCost, latency_ms: Date.now() - startMs })
      .eq("id", run.id);
    return { runId: run.id, error: err.message };
  }
}

// ---------- Thumbnail generation ----------
export async function runThumbnailGenerate(params: {
  optimizationRunId: string;
  youtubeVideoId: string;
  brandId: string;
}): Promise<{ count: number; error?: string }> {
  const voice = await loadBrandVoice(params.brandId);
  const { data: brand } = await supabaseAdmin.from("brands").select("name").eq("id", params.brandId).single();

  // Load transcript for context
  const { data: transcriptRow } = await supabaseAdmin
    .from("video_transcripts")
    .select("transcript_text")
    .eq("youtube_video_id", params.youtubeVideoId)
    .limit(1)
    .maybeSingle();

  const { data: video } = await supabaseAdmin
    .from("youtube_videos")
    .select("current_title")
    .eq("id", params.youtubeVideoId)
    .single();

  // Generate 3 thumbnail prompts via Claude
  const systemPrompt = "You are a YouTube thumbnail design expert. Generate image generation prompts for Flux Pro. Return valid JSON only.";
  const userPrompt = `Brand: ${brand?.name ?? "Unknown"}
Video title: ${video?.current_title ?? "Unknown"}
Thumbnail style rules: ${voice.thumbnail_style_rules}
Transcript excerpt: ${(transcriptRow?.transcript_text ?? "").slice(0, 1000)}

Generate 3 different thumbnail concepts. For each, provide:
- "prompt": A detailed image generation prompt for Flux Pro (describe the image composition, colors, mood, elements)
- "text_overlay": Suggested text to overlay on the thumbnail (short, punchy, 3-6 words)
- "layout_notes": Brief notes on layout/composition

Return as JSON array: [{"prompt": "...", "text_overlay": "...", "layout_notes": "..."}]`;

  const result = await callClaude(systemPrompt, userPrompt);
  let concepts: any[] = [];
  try {
    const jsonMatch = result.text.match(/\[[\s\S]*\]/);
    if (jsonMatch) concepts = JSON.parse(jsonMatch[0]);
  } catch {
    return { count: 0, error: "Failed to parse thumbnail concepts" };
  }

  let generated = 0;
  const lovableKey = process.env.LOVABLE_API_KEY;

  for (let i = 0; i < Math.min(concepts.length, 3); i++) {
    const concept = concepts[i];
    let imageUrl: string | null = null;
    let costUsd = 0;

    if (lovableKey) {
      try {
        // Use Lovable AI Gateway image generation model
        const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
            messages: [
              { role: "user", content: `Generate a YouTube thumbnail image (1280x720, 16:9 aspect ratio). ${concept.prompt}` },
            ],
          }),
        });

        if (imgRes.ok) {
          const imgData = await imgRes.json() as any;
          // Check for inline image data in the response
          const content = imgData.choices?.[0]?.message?.content;
          const inlineImage = imgData.choices?.[0]?.message?.inline_images?.[0];

          if (inlineImage?.data) {
            // Upload base64 image to Supabase storage
            const buffer = Uint8Array.from(atob(inlineImage.data), c => c.charCodeAt(0));
            const storagePath = `${params.brandId}/${params.youtubeVideoId}/${Date.now()}_v${i + 1}.png`;

            const { error: uploadErr } = await supabaseAdmin.storage
              .from("thumbnails")
              .upload(storagePath, buffer, { contentType: "image/png", upsert: true });

            if (!uploadErr) {
              const { data: pubUrl } = supabaseAdmin.storage.from("thumbnails").getPublicUrl(storagePath);
              imageUrl = pubUrl.publicUrl;
              costUsd = 0.02;
            }
          }
        }
      } catch (err) {
        console.error(`AI image generation error for thumbnail ${i + 1}:`, err);
      }
    }

    await supabaseAdmin.from("thumbnail_generations").insert({
      optimization_run_id: params.optimizationRunId,
      youtube_video_id: params.youtubeVideoId,
      brand_id: params.brandId,
      variant_index: i + 1,
      prompt: concept.prompt,
      generation_model: lovableKey ? "gemini-3-pro-image-preview" : "none",
      image_url: imageUrl,
      storage_path: imageUrl ? `thumbnails/${params.brandId}/${params.youtubeVideoId}/${Date.now()}_v${i + 1}.png` : null,
      text_overlay: concept.text_overlay,
      layout_notes: concept.layout_notes,
      cost_usd: costUsd,
    });
    generated++;
  }

  // Update run cost
  const { data: existingRun } = await supabaseAdmin.from("optimization_runs").select("cost_usd").eq("id", params.optimizationRunId).single();
  const thumbCost = computeCost(result.inputTokens, result.outputTokens) + generated * 0.05;
  await supabaseAdmin
    .from("optimization_runs")
    .update({ cost_usd: (existingRun?.cost_usd ?? 0) + thumbCost })
    .eq("id", params.optimizationRunId);

  return { count: generated };
}

// ---------- Audit queue builder ----------
export async function buildAuditQueue(brandId?: string): Promise<{ queued: number }> {
  // Clear existing queue
  if (brandId) {
    await supabaseAdmin.from("audit_queue").delete().eq("brand_id", brandId).eq("status", "queued");
  } else {
    await supabaseAdmin.from("audit_queue").delete().eq("status", "queued");
  }

  let query = supabaseAdmin.from("youtube_videos").select("*");
  if (brandId) query = query.eq("brand_id", brandId);

  const { data: videos } = await query;
  if (!videos?.length) return { queued: 0 };

  const entries: any[] = [];

  for (const v of videos) {
    const reasons: string[] = [];
    let score = Math.log((v.impressions ?? 0) + 1) * 10;

    if ((v.ctr ?? 100) < 4 && (v.impressions ?? 0) > 100) {
      score *= 2;
      reasons.push("Low CTR despite high impressions");
    }
    if (!v.current_description || (v.current_description?.length ?? 0) < 50) {
      score *= 1.5;
      reasons.push("Missing or weak description");
    }
    const tags = (v.current_tags as string[]) ?? [];
    if (tags.length < 5) {
      score *= 1.5;
      reasons.push("Fewer than 5 tags");
    }
    const title = (v.current_title ?? "").toLowerCase();
    if (/^(how to|best|ultimate)\b/.test(title) && title.length < 30) {
      score *= 1.2;
      reasons.push("Generic title pattern");
    }
    if (v.optimization_status !== "untouched") {
      // Already optimized recently?
      if (v.last_optimized_at && Date.now() - new Date(v.last_optimized_at).getTime() < 30 * 86400000) {
        score *= 0.5;
      }
    }
    if (!v.last_optimized_at && v.published_at && Date.now() - new Date(v.published_at).getTime() > 90 * 86400000) {
      score *= 1.3;
      reasons.push("Never optimized, older than 90 days");
    }

    // SEO score multiplier: low SEO score + high impressions = high priority
    const { data: seoRow } = await (supabaseAdmin as any)
      .from("video_seo_scores")
      .select("overall_score")
      .eq("youtube_video_id", v.id)
      .order("scored_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (seoRow?.overall_score != null) {
      const seoMultiplier = 1 + (100 - seoRow.overall_score) / 100;
      score *= seoMultiplier;
      if (seoRow.overall_score < 50) {
        reasons.push(`Low SEO score (${seoRow.overall_score})`);
      }
    }

    if (reasons.length > 0) {
      entries.push({
        youtube_video_id: v.id,
        brand_id: v.brand_id,
        opportunity_score: Math.round(score * 100) / 100,
        reasons,
        status: "queued",
      });
    }
  }

  // Sort and assign ranks
  entries.sort((a, b) => b.opportunity_score - a.opportunity_score);
  entries.forEach((e, i) => { e.priority_rank = i + 1; });

  if (entries.length > 0) {
    await supabaseAdmin.from("audit_queue").insert(entries);
  }

  return { queued: entries.length };
}

// ---------- Transcript fetch ----------
export async function fetchTranscript(youtubeVideoId: string, externalVideoId: string): Promise<{ success: boolean; error?: string }> {
  console.log(`[transcript] Starting fetch for video ${externalVideoId} (internal: ${youtubeVideoId})`);
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;

    // --- Strategy 0: Fetch real video metadata if title is placeholder ---
    if (apiKey) {
      try {
        const metaUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${externalVideoId}&key=${apiKey}`;
        const metaRes = await fetch(metaUrl);
        if (metaRes.ok) {
          const metaData = await metaRes.json() as any;
          const item = metaData.items?.[0];
          if (item) {
            const snippet = item.snippet ?? {};
            const stats = item.statistics ?? {};
            const updateFields: Record<string, any> = {};
            
            // Always update with real data from YouTube
            if (snippet.title) updateFields.current_title = snippet.title;
            if (snippet.description) updateFields.current_description = snippet.description;
            if (snippet.tags) updateFields.current_tags = snippet.tags;
            if (snippet.thumbnails?.high?.url) updateFields.current_thumbnail_url = snippet.thumbnails.high.url;
            if (stats.viewCount) updateFields.views = parseInt(stats.viewCount) || 0;
            if (stats.likeCount) updateFields.likes = parseInt(stats.likeCount) || 0;
            if (stats.commentCount) updateFields.comments = parseInt(stats.commentCount) || 0;
            if (snippet.publishedAt) updateFields.published_at = snippet.publishedAt;
            
            if (Object.keys(updateFields).length > 0) {
              console.log(`[transcript] Updating video metadata: title="${updateFields.current_title?.slice(0, 50)}"`);
              await supabaseAdmin.from("youtube_videos").update(updateFields).eq("id", youtubeVideoId);
            }
          }
        }
      } catch (e) {
        console.log(`[transcript] Metadata fetch failed: ${(e as any).message}`);
      }
    }

    // --- Strategy 1: YouTube Data API captions list (info only, download needs OAuth) ---
    if (apiKey) {
      console.log("[transcript] Trying YouTube Data API captions...");
      const listUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${externalVideoId}&key=${apiKey}`;
      const listRes = await fetch(listUrl);
      if (listRes.ok) {
        const listData = await listRes.json() as any;
        const items = listData.items ?? [];
        console.log(`[transcript] Found ${items.length} caption tracks`);
      }
    }

    // --- Strategy 2: YouTube timedtext endpoint (works without OAuth) ---
    console.log("[transcript] Trying timedtext endpoint...");
    const timedtextUrl = `https://www.youtube.com/api/timedtext?v=${externalVideoId}&lang=en&fmt=json3`;
    try {
      const ttRes = await fetch(timedtextUrl, {
        headers: { "Accept-Language": "en-US,en;q=0.9" },
      });

      if (ttRes.ok) {
        const ttText = await ttRes.text();
        if (ttText && ttText.startsWith("{")) {
          const ttData = JSON.parse(ttText);
          const events = ttData.events ?? [];
          if (events.length > 0) {
            const text = events
              .filter((e: any) => e.segs)
              .map((e: any) => e.segs.map((s: any) => s.utf8 ?? "").join(""))
              .join(" ")
              .replace(/\n/g, " ")
              .replace(/\s+/g, " ")
              .trim();

            if (text && text.length > 20) {
              console.log(`[transcript] Got ${text.length} chars from timedtext`);
              await supabaseAdmin.from("video_transcripts").upsert({
                youtube_video_id: youtubeVideoId,
                transcript_text: text,
                language: "en",
                segments: events.slice(0, 500),
              }, { onConflict: "youtube_video_id" });
              return { success: true };
            }
          }
        } else {
          console.log(`[transcript] timedtext response not JSON (length: ${ttText.length})`);
        }
      }
    } catch (e) {
      console.log(`[transcript] timedtext failed: ${(e as any).message}`);
    }

    // --- Strategy 3: Try auto-generated captions (asr=1) ---
    console.log("[transcript] Trying auto-generated captions...");
    const asrUrl = `https://www.youtube.com/api/timedtext?v=${externalVideoId}&lang=en&kind=asr&fmt=json3`;
    const asrRes = await fetch(asrUrl, {
      headers: { "Accept-Language": "en-US,en;q=0.9" },
    });

    if (asrRes.ok) {
      try {
        const asrData = await asrRes.json() as any;
        const events = asrData.events ?? [];
        if (events.length > 0) {
          const text = events
            .filter((e: any) => e.segs)
            .map((e: any) => e.segs.map((s: any) => s.utf8 ?? "").join(""))
            .join(" ")
            .replace(/\n/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (text && text.length > 20) {
            console.log(`[transcript] Got ${text.length} chars from ASR`);
            await supabaseAdmin.from("video_transcripts").upsert({
              youtube_video_id: youtubeVideoId,
              transcript_text: text,
              language: "en",
              segments: events.slice(0, 500),
            }, { onConflict: "youtube_video_id" });
            return { success: true };
          }
        }
      } catch {
        console.log("[transcript] ASR response was not valid JSON");
      }
    }

    // --- Strategy 4: Scrape the watch page (last resort) ---
    console.log("[transcript] Trying watch page scrape as last resort...");
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${externalVideoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await pageRes.text();
    console.log(`[transcript] Watch page HTML length: ${html.length}`);

    const captionMatch = html.match(/"captionTracks":\[(.*?)\]/);
    if (captionMatch) {
      const trackData = `[${captionMatch[1]}]`;
      let captionUrl = "";
      try {
        const tracks = JSON.parse(trackData);
        console.log(`[transcript] Found ${tracks.length} caption tracks in page`);
        const enTrack = tracks.find((t: any) => t.languageCode === "en" || t.vssId?.startsWith(".en"));
        if (enTrack?.baseUrl) captionUrl = enTrack.baseUrl;
      } catch {
        const urlMatch = captionMatch[1].match(/"baseUrl":"(.*?)"/);
        if (urlMatch) captionUrl = urlMatch[1].replace(/\\u0026/g, "&");
      }

      if (captionUrl) {
        const captionRes = await fetch(captionUrl + "&fmt=json3");
        if (captionRes.ok) {
          const captionData = await captionRes.json() as any;
          const events = captionData.events ?? [];
          const text = events
            .filter((e: any) => e.segs)
            .map((e: any) => e.segs.map((s: any) => s.utf8 ?? "").join(""))
            .join(" ")
            .replace(/\n/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (text && text.length > 20) {
            console.log(`[transcript] Got ${text.length} chars from page scrape`);
            await supabaseAdmin.from("video_transcripts").upsert({
              youtube_video_id: youtubeVideoId,
              transcript_text: text,
              language: "en",
              segments: events.slice(0, 500),
            }, { onConflict: "youtube_video_id" });
            return { success: true };
          }
        }
      }
    } else {
      console.log("[transcript] No captionTracks found in page HTML");
    }

    // No transcript found via any method — store placeholder
    console.log("[transcript] All methods failed, storing placeholder");
    await supabaseAdmin.from("video_transcripts").upsert({
      youtube_video_id: youtubeVideoId,
      transcript_text: "(No captions available for this video)",
      language: "en",
    }, { onConflict: "youtube_video_id" });
    return { success: true };
  } catch (err: any) {
    console.error(`[transcript] Error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ---------- Bootstrap voice from existing content ----------
export async function bootstrapVoiceFromContent(brandId: string): Promise<{ titlesAdded: number }> {
  const { data: brand } = await supabaseAdmin.from("brands").select("name, slug").eq("id", brandId).single();
  if (!brand) throw new Error("Brand not found");

  let approvedTitles: any[] = [];

  // Pull top LinkedIn posts
  if (brand.slug === "christine-jewell") {
    const { data: posts } = await supabaseAdmin
      .from("linkedin_posts")
      .select("topic, reach, reactions, post_date")
      .eq("account_label", "Christine")
      .order("reactions", { ascending: false })
      .limit(20);

    if (posts?.length) {
      approvedTitles.push(...posts.filter((p: any) => p.topic).map((p: any) => ({
        title: p.topic,
        source: "linkedin",
        engagement: p.reactions ?? 0,
        reason: `High engagement LinkedIn post (${p.reactions} reactions)`,
      })));
    }
  }

  // Pull YouTube content
  const { data: content } = await supabaseAdmin
    .from("content")
    .select("title, reach, engagement, channel")
    .eq("channel", "YouTube")
    .order("reach", { ascending: false })
    .limit(20);

  if (content?.length) {
    approvedTitles.push(...content.filter((c: any) => c.title).map((c: any) => ({
      title: c.title,
      source: "youtube",
      views: c.reach ?? 0,
      reason: `Published YouTube video (${c.reach ?? 0} views)`,
    })));
  }

  // Update the voice profile
  if (approvedTitles.length > 0) {
    const { data: profile } = await supabaseAdmin
      .from("brand_voice_profiles")
      .select("id, approved_title_examples")
      .eq("brand_id", brandId)
      .single();

    if (profile) {
      const existing = (profile.approved_title_examples as any[]) ?? [];
      const merged = [...existing, ...approvedTitles].slice(0, 50);
      await supabaseAdmin
        .from("brand_voice_profiles")
        .update({ approved_title_examples: merged })
        .eq("id", profile.id);
    }
  }

  return { titlesAdded: approvedTitles.length };
}

// ---------- Monthly cost summary ----------
export async function getMonthlyCostSummary(): Promise<{ totalCost: number; totalRuns: number; totalThumbnails: number }> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: runs } = await supabaseAdmin
    .from("optimization_runs")
    .select("cost_usd")
    .gte("created_at", startOfMonth.toISOString());

  const { data: thumbs } = await supabaseAdmin
    .from("thumbnail_generations")
    .select("cost_usd")
    .gte("created_at", startOfMonth.toISOString());

  const totalCost = (runs ?? []).reduce((s: number, r: any) => s + (r.cost_usd ?? 0), 0) +
    (thumbs ?? []).reduce((s: number, t: any) => s + (t.cost_usd ?? 0), 0);

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    totalRuns: runs?.length ?? 0,
    totalThumbnails: thumbs?.length ?? 0,
  };
}
