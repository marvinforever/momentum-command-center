// Queries for the new historical-metrics view + CRM.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------- Clients ----------------
export type Client = {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  sort_order: number | null;
  active: boolean;
};

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });
}

// ---------------- Metric definitions ----------------
export type MetricDef = {
  id: string;
  client_id: string;
  key: string;
  label: string;
  section: string;
  unit: string | null;
  format: string | null;
  source: string | null;
  sort_order: number | null;
  description: string | null;
  active: boolean;
};

export function useMetricDefinitions(clientId: string | undefined) {
  return useQuery({
    queryKey: ["metric_definitions", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metric_definitions")
        .select("*")
        .eq("client_id", clientId!)
        .eq("active", true)
        .order("section")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as MetricDef[];
    },
  });
}

// ---------------- Snapshots ----------------
export type Snapshot = {
  id: string;
  metric_definition_id: string;
  week_ending: string;
  value: number | null;
  value_text: string | null;
  note: string | null;
  source: string | null;
};

export function useSnapshotsForClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ["weekly_metric_snapshots", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      // Pull all defs first to constrain
      const { data: defs, error: defErr } = await supabase
        .from("metric_definitions")
        .select("id")
        .eq("client_id", clientId!);
      if (defErr) throw defErr;
      const ids = (defs ?? []).map((d: any) => d.id);
      if (ids.length === 0) return [] as Snapshot[];

      // Supabase has a 1000-row default; chunk by metric def is overkill — just request a high range.
      const all: Snapshot[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("weekly_metric_snapshots")
          .select("*")
          .in("metric_definition_id", ids)
          .order("week_ending", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = (data ?? []) as Snapshot[];
        all.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });
}

export function useUpsertSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      metric_definition_id: string;
      week_ending: string;
      value: number | null;
      value_text: string | null;
      clientId: string;
    }) => {
      const { error } = await supabase
        .from("weekly_metric_snapshots")
        .upsert(
          {
            metric_definition_id: input.metric_definition_id,
            week_ending: input.week_ending,
            value: input.value,
            value_text: input.value_text,
            source: "manual",
          },
          { onConflict: "metric_definition_id,week_ending" },
        );
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ["weekly_metric_snapshots", input.clientId] });
    },
  });
}

// ---------------- Contacts (CRM) ----------------
export const PIPELINE_STAGES = [
  "No Status",
  "Prospect",
  "Discovery Booked",
  "Follow Up",
  "Demo",
  "Proposal Sent",
  "Hold Off",
  "Closed Won",
  "Closed Lost",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const DEFAULT_CAMPAIGN_STAGES = [
  "Lead In",
  "Opt-In",
  "Call Booked",
  "Call Attended",
  "Follow Up",
  "Closed Won",
  "No Sale",
];

export type Campaign = {
  id: string;
  name: string;
  type: string | null;
  primary_channel: string | null;
  status: string | null;
  data_source: string;
  data_source_config: Record<string, any>;
  pipeline_stages: string[];
  color: string | null;
  archived: boolean;
  created_at: string;
};

export function useCampaigns() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("campaigns")
        .select("id,name,type,primary_channel,status,data_source,data_source_config,pipeline_stages,color,archived,created_at")
        .eq("archived", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; data_source?: string; primary_channel?: string; type?: string; color?: string; pipeline_stages?: string[] }) => {
      const payload: any = {
        name: input.name,
        data_source: input.data_source ?? "manual",
        primary_channel: input.primary_channel ?? "Other",
        type: input.type ?? "Evergreen",
        status: "Live",
        color: input.color ?? null,
        pipeline_stages: input.pipeline_stages ?? DEFAULT_CAMPAIGN_STAGES,
      };
      const { data, error } = await (supabase as any).from("campaigns").insert(payload).select().single();
      if (error) throw error;
      return data as Campaign;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

export type Contact = {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: string;
  client_id: string | null;
  campaign_id: string | null;
  owner: string | null;
  notes_summary: string | null;
  last_touch_at: string | null;
  next_followup_at: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export function useContacts() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("archived", false)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: ["contact", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Contact | null;
    },
  });
}

export function useContactNotes(id: string | undefined) {
  return useQuery({
    queryKey: ["contact_notes", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useContactActivity(id: string | undefined) {
  return useQuery({
    queryKey: ["contact_activity", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_activity")
        .select("*")
        .eq("contact_id", id!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useContactFollowUps(id: string | undefined) {
  return useQuery({
    queryKey: ["contact_follow_ups", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_follow_ups")
        .select("*")
        .eq("contact_id", id!)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDueFollowUps() {
  return useQuery({
    queryKey: ["due_follow_ups"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("contact_follow_ups")
        .select("*, contacts(id, name, company, stage)")
        .is("completed_at", null)
        .lte("due_date", today)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---------------- Mutations ----------------
export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Contact> & { name: string }) => {
      const { data, error } = await supabase.from("contacts").insert(input).select().single();
      if (error) throw error;
      await supabase.from("contact_activity").insert({
        contact_id: data.id,
        type: "created",
        description: `Contact created in stage "${input.stage ?? "No Status"}"`,
      });
      return data as Contact;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useUpdateContactStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; stage: string; previous: string }) => {
      const { error } = await supabase
        .from("contacts")
        .update({ stage: input.stage, last_touch_at: new Date().toISOString() })
        .eq("id", input.id);
      if (error) throw error;
      await supabase.from("contact_activity").insert({
        contact_id: input.id,
        type: "stage_change",
        description: `${input.previous} → ${input.stage}`,
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["contact_activity", vars.id] });
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<Contact>) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("contacts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["contact", vars.id] });
    },
  });
}

export function useAddContactNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { contact_id: string; body: string }) => {
      const { error } = await supabase.from("contact_notes").insert(input);
      if (error) throw error;
      await supabase.from("contact_activity").insert({
        contact_id: input.contact_id,
        type: "note",
        description: input.body.slice(0, 200),
      });
      await supabase
        .from("contacts")
        .update({ last_touch_at: new Date().toISOString() })
        .eq("id", input.contact_id);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["contact_notes", vars.contact_id] });
      qc.invalidateQueries({ queryKey: ["contact_activity", vars.contact_id] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useAddFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { contact_id: string; due_date: string; description: string }) => {
      const { error } = await supabase.from("contact_follow_ups").insert(input);
      if (error) throw error;
      await supabase.from("contact_activity").insert({
        contact_id: input.contact_id,
        type: "followup_created",
        description: `${input.due_date}: ${input.description}`,
      });
      await supabase
        .from("contacts")
        .update({ next_followup_at: input.due_date })
        .eq("id", input.contact_id);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["contact_follow_ups", vars.contact_id] });
      qc.invalidateQueries({ queryKey: ["contact_activity", vars.contact_id] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["due_follow_ups"] });
    },
  });
}

export function useCompleteFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; contact_id: string }) => {
      const { error } = await supabase
        .from("contact_follow_ups")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", input.id);
      if (error) throw error;
      await supabase.from("contact_activity").insert({
        contact_id: input.contact_id,
        type: "followup_completed",
        description: "Marked follow-up complete",
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["contact_follow_ups", vars.contact_id] });
      qc.invalidateQueries({ queryKey: ["contact_activity", vars.contact_id] });
      qc.invalidateQueries({ queryKey: ["due_follow_ups"] });
    },
  });
}
