/**
 * SEO Research & Scoring — server-only helpers.
 * NEVER import from client code.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- YouTube API quota tracker (in-memory, resets on restart) ----------
let dailyQuotaUsed = 0;
let quotaResetDate = new Date().toDateString();
const DAILY_QUOTA_LIMIT = 10000;

function trackQuota(units: number) {
  const today = new Date().toDateString();
  if (today !== quotaResetDate) {
    dailyQuotaUsed = 0;
    quotaResetDate = today;
  }
  dailyQuotaUsed += units;
}

function canUseQuota(units: number): boolean {
  const today = new Date().toDateString();
  if (today !== quotaResetDate) {
    dailyQuotaUsed = 0;
    quotaResetDate = today;
  }
  return dailyQuotaUsed + units <= DAILY_QUOTA_LIMIT;
}

export function getQuotaUsage() {
  const today = new Date().toDateString();
  if (today !== quotaResetDate) {
    dailyQuotaUsed = 0;
    quotaResetDate = today;
  }
  return { used: dailyQuotaUsed, limit: DAILY_QUOTA_LIMIT };
}

// ---------- Claude helper (reused from optimization.server) ----------
async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
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
  return data.content?.[0]?.text ?? "";
}

// ---------- YouTube Autocomplete (free, no quota) ----------
async function fetchAutocomplete(seed: string): Promise<string[]> {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(seed)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data[1] as string[]) ?? [];
  } catch {
    return [];
  }
}

// ---------- YouTube Search API ----------
async function youtubeSearch(query: string, maxResults = 10): Promise<any[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];
  if (!canUseQuota(100)) return [];

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&order=relevance&key=${apiKey}`;
  const res = await fetch(url);
  trackQuota(100);

  if (!res.ok) return [];
  const data = await res.json() as any;
  return data.items ?? [];
}

// ---------- YouTube Video Details ----------
async function youtubeVideoDetails(videoIds: string[]): Promise<any[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || videoIds.length === 0) return [];
  // costs 1 unit per call (part=snippet,statistics,contentDetails)
  if (!canUseQuota(1)) return [];

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&key=${apiKey}`;
  const res = await fetch(url);
  trackQuota(1);

  if (!res.ok) return [];
  const data = await res.json() as any;
  return data.items ?? [];
}

// ---------- KEYWORD RESEARCH ----------
export async function runKeywordResearch(params: {
  youtubeVideoId: string;
  optimizationRunId?: string;
}): Promise<{ keywords: any[]; error?: string }> {
  try {
    console.log(`[seo] Starting keyword research for video ${params.youtubeVideoId}`);

    // Load video
    const { data: video } = await supabaseAdmin
      .from("youtube_videos")
      .select("id, youtube_video_id, current_title, current_description, current_tags")
      .eq("id", params.youtubeVideoId)
      .single();
    if (!video) return { keywords: [], error: "Video not found" };

    console.log(`[seo] Video: "${video.current_title}"`);

    // Load transcript
    const { data: transcript } = await supabaseAdmin
      .from("video_transcripts")
      .select("transcript_text")
      .eq("youtube_video_id", params.youtubeVideoId)
      .maybeSingle();

    const transcriptText = transcript?.transcript_text?.slice(0, 3000) ?? "";
    const title = video.current_title ?? "";
    const description = (video.current_description ?? "").slice(0, 500);

    console.log(`[seo] Transcript length: ${transcriptText.length}, Title: "${title}", Desc length: ${description.length}`);

    // 1. Extract topic seeds via Claude
    const seedResponse = await callClaude(
      "You extract core topic seeds from YouTube video content. Return JSON only.",
      `Extract 5-7 short topic seed phrases (2-4 words each) from this video content.
These should be searchable topics someone might type into YouTube.

Title: ${title}
Description: ${description}
Transcript excerpt: ${transcriptText.slice(0, 2000)}

Return as JSON array of strings: ["seed phrase 1", "seed phrase 2", ...]`
    );

    console.log(`[seo] Claude seed response: ${seedResponse.slice(0, 200)}`);

    let seeds: string[] = [];
    try {
      const match = seedResponse.match(/\[[\s\S]*?\]/);
      if (match) seeds = JSON.parse(match[0]);
    } catch {
      seeds = [title.split(" ").slice(0, 4).join(" ")];
    }

    console.log(`[seo] Extracted ${seeds.length} seeds: ${JSON.stringify(seeds)}`)

    // 2. YouTube autocomplete for each seed (free, unlimited)
    const allSuggestions = new Map<string, { source: string; rank: number }>();
    for (const seed of seeds.slice(0, 7)) {
      const suggestions = await fetchAutocomplete(seed);
      suggestions.forEach((s, i) => {
        const key = s.toLowerCase().trim();
        if (!allSuggestions.has(key)) {
          allSuggestions.set(key, { source: "youtube_autocomplete", rank: i + 1 });
        }
      });
    }

    // Also add transcript-extracted seeds
    seeds.forEach((s) => {
      const key = s.toLowerCase().trim();
      if (!allSuggestions.has(key)) {
        allSuggestions.set(key, { source: "transcript_extract", rank: 5 });
      }
    });

    // 3. For top 5 candidates, do a YouTube search for competition signals (costs quota)
    const candidates = Array.from(allSuggestions.entries())
      .sort((a, b) => a[1].rank - b[1].rank)
      .slice(0, 30);

    const keywordResults: any[] = [];

    for (const [keyword, meta] of candidates) {
      let searchVolume = Math.max(10, 100 - meta.rank * 10); // rough estimate from autocomplete rank
      let competition = 50;

      // For top candidates, try a YouTube search for better signals
      if (keywordResults.length < 5 && canUseQuota(100)) {
        const searchResults = await youtubeSearch(keyword, 5);
        if (searchResults.length > 0) {
          // Higher result count => higher competition
          competition = Math.min(95, searchResults.length * 15);
        }
      }

      // Relevance: how much this keyword overlaps with the video content
      const lowerTitle = title.toLowerCase();
      const lowerTranscript = transcriptText.toLowerCase();
      const kwWords = keyword.split(" ");
      const titleOverlap = kwWords.filter(w => lowerTitle.includes(w)).length / kwWords.length;
      const transcriptOverlap = kwWords.filter(w => lowerTranscript.includes(w)).length / kwWords.length;
      const relevance = Math.round((titleOverlap * 40 + transcriptOverlap * 60) * 100) / 100;

      keywordResults.push({
        keyword,
        source: meta.source,
        search_volume_estimate: searchVolume,
        competition_score: competition,
        relevance_score: relevance,
        // Composite score: relevance × log(volume) / sqrt(competition)
        _composite: relevance * Math.log(searchVolume + 1) / Math.sqrt(competition + 1),
      });
    }

    // Sort by composite
    keywordResults.sort((a, b) => b._composite - a._composite);
    const top30 = keywordResults.slice(0, 30);

    // Clear old research for this video
    await (supabaseAdmin as any)
      .from("seo_keyword_research")
      .delete()
      .eq("youtube_video_id", params.youtubeVideoId);

    // Insert
    for (const kw of top30) {
      await (supabaseAdmin as any).from("seo_keyword_research").insert({
        youtube_video_id: params.youtubeVideoId,
        optimization_run_id: params.optimizationRunId ?? null,
        keyword: kw.keyword,
        source: kw.source as any,
        search_volume_estimate: kw.search_volume_estimate,
        competition_score: kw.competition_score,
        relevance_score: kw.relevance_score,
        is_target: false,
      });
    }

    return {
      keywords: top30.map(({ _composite, ...rest }) => rest),
    };
  } catch (err: any) {
    return { keywords: [], error: err.message };
  }
}

// ---------- SEO CURRENT SCORE ----------
export async function runSeoScore(params: {
  youtubeVideoId: string;
  optimizationRunId?: string;
}): Promise<{ score: any; error?: string }> {
  try {
    const { data: video } = await supabaseAdmin
      .from("youtube_videos")
      .select("*")
      .eq("id", params.youtubeVideoId)
      .single();
    if (!video) return { score: null, error: "Video not found" };

    // Load target keywords
    const { data: targetKws } = await (supabaseAdmin as any)
      .from("seo_keyword_research")
      .select("keyword")
      .eq("youtube_video_id", params.youtubeVideoId)
      .eq("is_target", true);
    const targetKeywords = (targetKws ?? []).map((k: any) => k.keyword.toLowerCase());

    const title = video.current_title ?? "";
    const description = video.current_description ?? "";
    const tags = (video.current_tags as string[]) ?? [];
    const views = video.views ?? 0;
    const likes = video.likes ?? 0;
    const comments = video.comments ?? 0;
    const issues: any[] = [];

    // --- Title Score ---
    let titleScore = 0;
    const titleLen = title.length;
    if (titleLen >= 60 && titleLen <= 70) { titleScore += 10; }
    else if (titleLen >= 40 && titleLen < 60) { titleScore += 8; }
    else {
      issues.push({ severity: titleLen < 20 ? "high" : "medium", message: `Title is ${titleLen} chars; optimal is 60-70`, fix: `Adjust title to 60-70 characters for better CTR.` });
    }

    const lowerTitle = title.toLowerCase();
    if (targetKeywords.some((kw: string) => lowerTitle.includes(kw))) { titleScore += 20; }
    else if (targetKeywords.length > 0) {
      issues.push({ severity: "high", message: "Target keyword missing from title", fix: `Include your primary keyword "${targetKeywords[0]}" naturally in the title.` });
    }

    if (/\d/.test(title)) titleScore += 10;
    if (/^(who|what|when|where|why|how|is|are|can|do|does|did|will|should)\b/i.test(title)) titleScore += 5;
    if (/\b(why|stop|secret|truth|never|always|best|worst|mistake)\b/i.test(title)) titleScore += 5;
    if (/[A-Z]{3,}/.test(title)) {
      titleScore -= 10;
      issues.push({ severity: "low", message: "Title contains ALL-CAPS words", fix: "Remove all-caps for a more professional look." });
    }
    titleScore = Math.min(100, Math.max(0, titleScore));

    // --- Description Score ---
    let descScore = 0;
    const descLen = description.length;
    if (descLen >= 250) { descScore += 20; }
    else if (descLen >= 100) { descScore += 10; }
    else {
      issues.push({ severity: "high", message: `Description is only ${descLen} characters`, fix: "Expand description to at least 250 characters. Include target keywords in the first 25 chars." });
    }

    const descFirst25 = description.slice(0, 25).toLowerCase();
    if (targetKeywords.some((kw: string) => descFirst25.includes(kw))) descScore += 25;
    else if (targetKeywords.length > 0) {
      issues.push({ severity: "medium", message: "Target keyword not in first 25 chars of description", fix: `Start description with "${targetKeywords[0]}" for SEO.` });
    }

    if (/\d+:\d{2}/.test(description)) descScore += 15; // timestamps
    if (/https?:\/\//.test(description)) descScore += 10; // CTA link
    if (/#\w+/.test(description)) descScore += 10; // hashtags
    if ((description.match(/\n\n/g) ?? []).length >= 2) descScore += 10; // paragraphs
    // Keyword density
    const kwCount = targetKeywords.reduce((sum: number, kw: string) => sum + (description.toLowerCase().split(kw).length - 1), 0);
    if (kwCount >= 3 && kwCount <= 5) descScore += 10;
    descScore = Math.min(100, Math.max(0, descScore));

    // --- Tags Score ---
    let tagsScore = 0;
    const tagCount = tags.length;
    if (tagCount >= 5 && tagCount <= 15) { tagsScore += 30; }
    else if (tagCount >= 1 && tagCount < 5) {
      tagsScore += 10;
      issues.push({ severity: "medium", message: `Only ${tagCount} tags; optimal is 5-15`, fix: "Add more relevant tags (mix of broad and long-tail)." });
    } else if (tagCount === 0) {
      issues.push({ severity: "high", message: "No tags on this video", fix: "Add 5-15 relevant tags including target keywords and brand name." });
    }

    // Mix: check for both short (broad) and long tags
    const shortTags = tags.filter(t => t.split(" ").length <= 2).length;
    const longTags = tags.filter(t => t.split(" ").length > 2).length;
    if (shortTags > 0 && longTags > 0) tagsScore += 20;

    if (targetKeywords.some((kw: string) => tags.some(t => t.toLowerCase().includes(kw)))) tagsScore += 25;
    else if (targetKeywords.length > 0) {
      issues.push({ severity: "medium", message: "Target keyword not in tags", fix: `Add "${targetKeywords[0]}" as a tag.` });
    }

    // Brand name tag (check if any tag matches brand name)
    // Simple heuristic: check for common brand-like tags
    tagsScore += 10; // assume brand tag present
    tagsScore = Math.min(100, Math.max(0, tagsScore));

    // --- Thumbnail Score ---
    let thumbnailScore = 0;
    if (video.current_thumbnail_url) {
      thumbnailScore += 20;
      thumbnailScore += 30; // assume custom if present
      thumbnailScore += 20; // text overlay unknown, give benefit of doubt
      thumbnailScore += 20; // contrast unknown
    } else {
      issues.push({ severity: "high", message: "No thumbnail detected", fix: "Upload a custom thumbnail with clear text overlay and high contrast." });
    }
    thumbnailScore = Math.min(100, Math.max(0, thumbnailScore));

    // --- Engagement Signals ---
    let engagementScore = 0;
    if (views > 0) {
      const likeRatio = (likes / views) * 100;
      const commentRatio = (comments / views) * 100;
      if (likeRatio > 3) engagementScore += 30;
      else if (likeRatio > 1) engagementScore += 15;
      else issues.push({ severity: "low", message: `Low like-to-view ratio (${likeRatio.toFixed(1)}%)`, fix: "Add a CTA asking viewers to like. Engage in first hour." });

      if (commentRatio > 0.5) engagementScore += 20;
      else if (commentRatio > 0.1) engagementScore += 10;
    }
    engagementScore += 50; // avg view duration unknown, give partial
    engagementScore = Math.min(100, Math.max(0, engagementScore));

    // --- Metadata Completeness ---
    let metadataScore = 0;
    if (/\d+:\d{2}/.test(description)) metadataScore += 20; // chapters
    metadataScore += 10; // end-screen unknown
    metadataScore += 10; // cards unknown
    metadataScore += 10; // captions assumed
    if (description.length < 100) {
      issues.push({ severity: "medium", message: "No chapters/timestamps in description", fix: "Add timestamps for key sections to enable YouTube chapters." });
    }
    metadataScore = Math.min(100, Math.max(0, metadataScore));

    // --- Keyword Alignment ---
    let keywordScore = 0;
    if (targetKeywords.length > 0) {
      const titleHas = targetKeywords.some((kw: string) => lowerTitle.includes(kw));
      const descHas = targetKeywords.some((kw: string) => description.toLowerCase().includes(kw));
      const tagsHas = targetKeywords.some((kw: string) => tags.some(t => t.toLowerCase().includes(kw)));
      if (titleHas) keywordScore += 35;
      if (descHas) keywordScore += 35;
      if (tagsHas) keywordScore += 30;
    } else {
      keywordScore = 50; // no targets selected
    }
    keywordScore = Math.min(100, Math.max(0, keywordScore));

    // --- Overall ---
    const overall = Math.round(
      titleScore * 0.20 +
      descScore * 0.20 +
      tagsScore * 0.15 +
      thumbnailScore * 0.10 +
      engagementScore * 0.10 +
      metadataScore * 0.10 +
      keywordScore * 0.15
    );

    const scoreRow = {
      youtube_video_id: params.youtubeVideoId,
      optimization_run_id: params.optimizationRunId ?? null,
      overall_score: overall,
      title_score: titleScore,
      description_score: descScore,
      tags_score: tagsScore,
      thumbnail_score: thumbnailScore,
      engagement_signals_score: engagementScore,
      metadata_completeness_score: metadataScore,
      keyword_alignment_score: keywordScore,
      issues,
    };

    await (supabaseAdmin as any).from("video_seo_scores").insert(scoreRow);

    return { score: scoreRow };
  } catch (err: any) {
    return { score: null, error: err.message };
  }
}

// ---------- COMPETITOR ANALYSIS ----------
export async function runCompetitorAnalysis(params: {
  optimizationRunId: string;
  targetKeywords: string[];
}): Promise<{ patterns: any; competitors: any[]; error?: string }> {
  try {
    const allCompetitors: any[] = [];

    for (const keyword of params.targetKeywords.slice(0, 3)) {
      if (!canUseQuota(100)) {
        continue; // skip if over quota
      }

      const searchResults = await youtubeSearch(keyword, 10);
      if (searchResults.length === 0) continue;

      const videoIds = searchResults.map((r: any) => r.id?.videoId).filter(Boolean);
      const details = videoIds.length > 0 ? await youtubeVideoDetails(videoIds) : [];

      for (let i = 0; i < searchResults.length; i++) {
        const sr = searchResults[i];
        const detail = details.find((d: any) => d.id === sr.id?.videoId);
        const snippet = detail?.snippet ?? sr.snippet ?? {};
        const stats = detail?.statistics ?? {};
        const vidTitle = snippet.title ?? "";

        const comp = {
          optimization_run_id: params.optimizationRunId,
          target_keyword: keyword,
          competitor_youtube_video_id: sr.id?.videoId ?? "",
          rank_position: i + 1,
          channel_id: snippet.channelId ?? null,
          channel_name: snippet.channelTitle ?? null,
          title: vidTitle,
          description_excerpt: (snippet.description ?? "").slice(0, 300),
          tags: snippet.tags ?? [],
          views: parseInt(stats.viewCount ?? "0"),
          likes: parseInt(stats.likeCount ?? "0"),
          comments: parseInt(stats.commentCount ?? "0"),
          publish_date: snippet.publishedAt?.split("T")[0] ?? null,
          duration_seconds: parseDuration(detail?.contentDetails?.duration),
          thumbnail_url: snippet.thumbnails?.medium?.url ?? null,
          title_length: vidTitle.length,
          title_starts_with_question: /^(who|what|when|where|why|how|is|are|can|do|does)\b/i.test(vidTitle),
          title_contains_number: /\d/.test(vidTitle),
          description_length: (snippet.description ?? "").length,
          tag_count: (snippet.tags ?? []).length,
        };

        allCompetitors.push(comp);
        await (supabaseAdmin as any).from("seo_competitor_videos").insert(comp);
      }
    }

    // Aggregate patterns
    const titles = allCompetitors.map(c => c.title);
    const patterns = {
      avg_title_length: Math.round(allCompetitors.reduce((s, c) => s + c.title_length, 0) / (allCompetitors.length || 1)),
      title_starts_with_question_pct: Math.round(allCompetitors.filter(c => c.title_starts_with_question).length / (allCompetitors.length || 1) * 100),
      title_contains_number_pct: Math.round(allCompetitors.filter(c => c.title_contains_number).length / (allCompetitors.length || 1) * 100),
      avg_description_length: Math.round(allCompetitors.reduce((s, c) => s + c.description_length, 0) / (allCompetitors.length || 1)),
      median_views: allCompetitors.length > 0 ? allCompetitors.sort((a, b) => a.views - b.views)[Math.floor(allCompetitors.length / 2)]?.views : 0,
      common_title_words: extractCommonWords(titles, 10),
      common_tags: extractCommonTags(allCompetitors),
    };

    return { patterns, competitors: allCompetitors };
  } catch (err: any) {
    return { patterns: null, competitors: [], error: err.message };
  }
}

function parseDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  return (parseInt(match[1] ?? "0") * 3600) + (parseInt(match[2] ?? "0") * 60) + parseInt(match[3] ?? "0");
}

function extractCommonWords(titles: string[], limit: number): string[] {
  const stopWords = new Set(["the", "a", "an", "is", "in", "on", "at", "to", "for", "of", "and", "or", "but", "with", "your", "you", "this", "that", "it", "i", "my", "me", "we", "our", "his", "her"]);
  const counts = new Map<string, number>();
  for (const t of titles) {
    for (const w of t.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/)) {
      if (w.length > 2 && !stopWords.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(e => e[0]);
}

function extractCommonTags(competitors: any[]): string[] {
  const counts = new Map<string, number>();
  for (const c of competitors) {
    for (const t of (c.tags ?? [])) {
      const key = (t as string).toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => e[0]);
}

// ---------- KEYWORD RANKING CHECK ----------
export async function runKeywordRankingCheck(params: {
  limit?: number;
}): Promise<{ checked: number; error?: string }> {
  const limit = params.limit ?? 100;
  try {
    // Get all target keywords with their videos
    const { data: targets } = await (supabaseAdmin as any)
      .from("seo_keyword_research")
      .select("youtube_video_id, keyword, youtube_videos!inner(youtube_video_id)")
      .eq("is_target", true)
      .limit(limit);

    if (!targets?.length) return { checked: 0 };

    let checked = 0;
    for (const t of targets) {
      if (!canUseQuota(100)) break;

      const externalId = (t as any).youtube_videos?.youtube_video_id;
      if (!externalId) continue;

      const results = await youtubeSearch(t.keyword, 50);
      const rankPos = results.findIndex((r: any) => r.id?.videoId === externalId);

      await (supabaseAdmin as any).from("keyword_rankings").insert({
        youtube_video_id: t.youtube_video_id,
        keyword: t.keyword,
        rank_position: rankPos >= 0 ? rankPos + 1 : null,
        total_results_estimated: results.length,
      });

      checked++;
    }

    return { checked };
  } catch (err: any) {
    return { checked: 0, error: err.message };
  }
}

// ---------- PREDICT SEO SCORE for generated content ----------
export function predictSeoScore(params: {
  outputType: string;
  content: string;
  targetKeywords: string[];
  currentScore: number;
}): number {
  const { outputType, content, targetKeywords, currentScore } = params;
  const lower = content.toLowerCase();
  let predicted = currentScore;

  if (outputType === "title") {
    const len = content.length;
    if (len >= 60 && len <= 70) predicted += 5;
    if (targetKeywords.some((kw: string) => lower.includes(kw.toLowerCase()))) predicted += 15;
    if (/\d/.test(content)) predicted += 5;
    if (/^(who|what|when|where|why|how)\b/i.test(content)) predicted += 3;
  } else if (outputType === "description") {
    if (content.length >= 250) predicted += 10;
    if (targetKeywords.some((kw: string) => lower.slice(0, 25).includes(kw.toLowerCase()))) predicted += 15;
    if (/\d+:\d{2}/.test(content)) predicted += 8;
    if (/https?:\/\//.test(content)) predicted += 5;
  } else if (outputType === "tags") {
    const tagArr = content.split(",").map(t => t.trim());
    if (tagArr.length >= 5 && tagArr.length <= 15) predicted += 10;
    if (targetKeywords.some((kw: string) => tagArr.some(t => t.toLowerCase().includes(kw.toLowerCase())))) predicted += 15;
  }

  return Math.min(100, Math.max(0, Math.round(predicted)));
}
