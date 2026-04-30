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

    for (const outputType of params.outputTypes) {
      if (outputType === "thumbnail_concept" || outputType === "thumbnail_text") continue;

      const systemPrompt = `You are a YouTube content optimization expert working for the brand "${brand?.name ?? "Unknown"}".
You generate high-quality, brand-aligned ${outputType}s for YouTube videos.
You MUST return valid JSON only. No preamble, no explanation outside JSON.`;

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
Generate 5 options for ${outputType}. For each, provide:
- The ${outputType} itself (key: "content")
- A one-sentence rationale (key: "rationale")
- Self-assessed scores 0-100 (keys: "brand_voice_score", "human_sounding_score", "approval_likelihood_score", "seo_score")
- Any guardrail warnings as string array (key: "warnings")
${targetKeywords.length > 0 ? `\nIMPORTANT: Naturally include the top 2 target keywords: "${targetKeywords.slice(0, 2).join('", "')}". Address the SEO issues listed above.` : ""}
${outputType === "tags" ? 'For tags, "content" should be a comma-separated list of tags.' : ""}
${outputType === "description" ? "Description should be 150-300 words. Include relevant keywords naturally. End with a clear call-to-action." : ""}
${outputType === "title" ? "Title should be under 70 characters. Engaging but not clickbait." : ""}
${outputType === "pinned_comment" ? "Write a warm, engaging pinned comment that drives discussion. 2-4 sentences." : ""}
${outputType === "hook" ? "Write the first 3 sentences/hook of the video that grabs attention in the first 5 seconds." : ""}

Return as JSON array: [{"content": "...", "rationale": "...", "brand_voice_score": N, "human_sounding_score": N, "approval_likelihood_score": N, "seo_score": N, "warnings": []}]`;

      const result = await callClaude(systemPrompt, userPrompt);
      totalCost += computeCost(result.inputTokens, result.outputTokens);
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;

      // Parse JSON from Claude response
      let variants: any[] = [];
      try {
        // Try to extract JSON array from the response
        const jsonMatch = result.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          variants = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.error(`Failed to parse Claude response for ${outputType}:`, result.text.slice(0, 200));
        continue;
      }

      // Run guardrails and re-score, then take top 3
      const scored = variants.map((v: any) => {
        const guardrails = runGuardrails(v.content ?? "", voice.banned_phrases);
        return {
          ...v,
          passed_guardrails: guardrails.passed,
          guardrail_warnings: [...(v.warnings ?? []), ...guardrails.warnings],
          // Composite score for ranking
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
          content_json: outputType === "tags" ? { tags: (v.content ?? "").split(",").map((t: string) => t.trim()) } : null,
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
  // Use YouTube's timedtext API (community captions)
  try {
    const url = `https://www.youtube.com/watch?v=${externalVideoId}`;
    const pageRes = await fetch(url);
    const html = await pageRes.text();

    // Extract caption track URL from page source
    const captionMatch = html.match(/"captionTracks":\[(.*?)\]/);
    if (!captionMatch) {
      // No captions available — store empty
      await supabaseAdmin.from("video_transcripts").upsert({
        youtube_video_id: youtubeVideoId,
        transcript_text: "(No captions available for this video)",
        language: "en",
      }, { onConflict: "youtube_video_id" });
      return { success: true };
    }

    // Try to find English caption URL
    const trackData = `[${captionMatch[1]}]`;
    let captionUrl = "";
    try {
      const tracks = JSON.parse(trackData);
      const enTrack = tracks.find((t: any) => t.languageCode === "en" || t.vssId?.startsWith(".en"));
      if (enTrack?.baseUrl) captionUrl = enTrack.baseUrl;
    } catch {
      // Fallback: regex extract
      const urlMatch = captionMatch[1].match(/"baseUrl":"(.*?)"/);
      if (urlMatch) captionUrl = urlMatch[1].replace(/\\u0026/g, "&");
    }

    if (!captionUrl) {
      await supabaseAdmin.from("video_transcripts").upsert({
        youtube_video_id: youtubeVideoId,
        transcript_text: "(No English captions found)",
        language: "en",
      }, { onConflict: "youtube_video_id" });
      return { success: true };
    }

    // Fetch the transcript XML
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

      await supabaseAdmin.from("video_transcripts").upsert({
        youtube_video_id: youtubeVideoId,
        transcript_text: text || "(Empty transcript)",
        language: "en",
        segments: events.slice(0, 500), // store first 500 segments
      }, { onConflict: "youtube_video_id" });
      return { success: true };
    }

    // Fallback to XML format
    const xmlRes = await fetch(captionUrl);
    if (xmlRes.ok) {
      const xmlText = await xmlRes.text();
      // Simple XML text extraction
      const text = xmlText.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
      await supabaseAdmin.from("video_transcripts").upsert({
        youtube_video_id: youtubeVideoId,
        transcript_text: text || "(Empty transcript)",
        language: "en",
      }, { onConflict: "youtube_video_id" });
      return { success: true };
    }

    return { success: false, error: "Failed to fetch captions" };
  } catch (err: any) {
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
