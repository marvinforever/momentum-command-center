import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, daysAgo, isoDate } from "@/lib/format";

export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDiscoveryCalls() {
  return useQuery({
    queryKey: ["discovery_calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discovery_calls")
        .select("*")
        .order("call_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCampaigns() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*, lead_magnets(name), offers(name, price)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ["campaign", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*, lead_magnets(name), offers(name, price)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useContent() {
  return useQuery({
    queryKey: ["content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .order("publish_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLeadMagnets() {
  return useQuery({
    queryKey: ["lead_magnets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_magnets").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOffers() {
  return useQuery({
    queryKey: ["offers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("offers").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useChannelMetrics() {
  return useQuery({
    queryKey: ["channel_metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_metrics")
        .select("*")
        .order("snapshot_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useYoutubeChannels() {
  return useQuery({
    queryKey: ["youtube_channels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("youtube_channels").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useYoutubeContent() {
  return useQuery({
    queryKey: ["content", "youtube"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .not("youtube_video_id", "is", null)
        .order("publish_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMetaAdsDaily(days = 30) {
  return useQuery({
    queryKey: ["meta_ads_daily", days],
    queryFn: async () => {
      const from = isoDate(daysAgo(days));
      const { data, error } = await supabase
        .from("meta_ads_daily")
        .select("*")
        .gte("snapshot_date", from)
        .order("snapshot_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMetaCampaigns() {
  return useQuery({
    queryKey: ["meta_campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_campaigns")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMetaAdSets(campaignId?: string) {
  return useQuery({
    queryKey: ["meta_adsets", campaignId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("meta_adsets").select("*").order("name");
      if (campaignId) q = q.eq("meta_campaign_id", campaignId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMetaAds(filters: { campaignId?: string; adsetId?: string } = {}) {
  return useQuery({
    queryKey: ["meta_ads", filters.campaignId ?? "", filters.adsetId ?? ""],
    queryFn: async () => {
      let q = supabase.from("meta_ads").select("*").order("name");
      if (filters.adsetId) q = q.eq("meta_adset_id", filters.adsetId);
      else if (filters.campaignId) q = q.eq("meta_campaign_id", filters.campaignId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMetaAd(adId?: string) {
  return useQuery({
    queryKey: ["meta_ad", adId],
    enabled: !!adId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_ads")
        .select("*")
        .eq("meta_ad_id", adId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMetaAdsetsDaily(filters: { campaignId?: string; adsetId?: string; days?: number } = {}) {
  const days = filters.days ?? 30;
  return useQuery({
    queryKey: ["meta_adsets_daily", filters.campaignId ?? "", filters.adsetId ?? "", days],
    queryFn: async () => {
      const from = isoDate(daysAgo(days));
      let q = supabase
        .from("meta_adsets_daily")
        .select("*")
        .gte("snapshot_date", from)
        .order("snapshot_date", { ascending: true });
      if (filters.adsetId) q = q.eq("meta_adset_id", filters.adsetId);
      else if (filters.campaignId) q = q.eq("meta_campaign_id", filters.campaignId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMetaAdsInsightsDaily(filters: { campaignId?: string; adsetId?: string; adId?: string; days?: number } = {}) {
  const days = filters.days ?? 30;
  return useQuery({
    queryKey: ["meta_ads_insights_daily", filters.campaignId ?? "", filters.adsetId ?? "", filters.adId ?? "", days],
    queryFn: async () => {
      const from = isoDate(daysAgo(days));
      let q = supabase
        .from("meta_ads_insights_daily")
        .select("*")
        .gte("snapshot_date", from)
        .order("snapshot_date", { ascending: true });
      if (filters.adId) q = q.eq("meta_ad_id", filters.adId);
      else if (filters.adsetId) q = q.eq("meta_adset_id", filters.adsetId);
      else if (filters.campaignId) q = q.eq("meta_campaign_id", filters.campaignId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMetaSyncRuns() {
  return useQuery({
    queryKey: ["meta_sync_runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_sync_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function monthFilter() {
  return { from: startOfMonth().toISOString().slice(0, 10), to: endOfMonth().toISOString().slice(0, 10) };
}

export function last7Filter() {
  return { from: isoDate(daysAgo(7)), to: isoDate(new Date()) };
}

export function last30Filter() {
  return { from: isoDate(daysAgo(30)), to: isoDate(new Date()) };
}
