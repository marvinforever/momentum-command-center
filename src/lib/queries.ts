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

export function monthFilter() {
  return { from: startOfMonth().toISOString().slice(0, 10), to: endOfMonth().toISOString().slice(0, 10) };
}

export function last7Filter() {
  return { from: isoDate(daysAgo(7)), to: isoDate(new Date()) };
}

export function last30Filter() {
  return { from: isoDate(daysAgo(30)), to: isoDate(new Date()) };
}
