import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard } from "@/components/mc/Primitives";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapVoiceFn } from "@/server/optimization.functions";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/brands")({
  head: () => ({ meta: [{ title: "Brand Voices — Momentum" }] }),
  component: BrandsPage,
});

const inputCls = "w-full rounded-lg border border-line bg-cream px-3 py-2.5 text-[13px] text-ink focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30 transition";

function BrandsPage() {
  const [activeBrandId, setActiveBrandId] = useState<string>("");
  const qc = useQueryClient();
  const bootstrapFn = useServerFn(bootstrapVoiceFn);

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("*").order("name");
      return data ?? [];
    },
  });

  const selectedBrandId = activeBrandId || brands[0]?.id;
  const selectedBrand = brands.find((b: any) => b.id === selectedBrandId);

  const { data: profile } = useQuery({
    queryKey: ["brand-voice-profile", selectedBrandId],
    queryFn: async () => {
      if (!selectedBrandId) return null;
      const { data } = await supabase.from("brand_voice_profiles").select("*").eq("brand_id", selectedBrandId).maybeSingle();
      return data;
    },
    enabled: !!selectedBrandId,
  });

  const { data: feedbackCount = 0 } = useQuery({
    queryKey: ["feedback-count", selectedBrandId],
    queryFn: async () => {
      if (!selectedBrandId) return 0;
      const { count } = await supabase.from("approval_feedback").select("*", { count: "exact", head: true }).eq("brand_id", selectedBrandId);
      return count ?? 0;
    },
    enabled: !!selectedBrandId,
  });

  const voiceConfidence = feedbackCount < 5 ? "Low" : feedbackCount < 15 ? "Medium" : "High";
  const voiceColor = voiceConfidence === "Low" ? "text-burgundy" : voiceConfidence === "Medium" ? "text-amber" : "text-sage";

  async function handleBootstrap() {
    if (!selectedBrandId) return;
    try {
      const result = await bootstrapFn({ data: { brandId: selectedBrandId } });
      toast.success(`Bootstrapped ${result.titlesAdded} examples from existing data.`);
      qc.invalidateQueries({ queryKey: ["brand-voice-profile"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Brand Voice Profiles"
        subtitle="Voice rules, examples, and learning data per brand"
        breadcrumbs={[
          { label: "Command Center", to: "/" },
          { label: "Optimization", to: "/admin/optimization" },
          { label: "Brands" },
        ]}
      />

      {/* Brand selector */}
      <div className="flex items-center gap-3 mb-6">
        <select className={inputCls + " max-w-xs"} value={selectedBrandId ?? ""} onChange={(e) => setActiveBrandId(e.target.value)}>
          {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <div className={cn("mc-tag", voiceColor === "text-sage" ? "bg-sage-bg text-sage" : voiceColor === "text-amber" ? "bg-amber-bg text-amber" : "bg-burgundy-bg text-burgundy")}>
          Voice Confidence: {voiceConfidence} ({feedbackCount} feedback events)
        </div>
      </div>

      {voiceConfidence === "Low" && (
        <MCCard className="p-4 mb-4 bg-amber-bg border-amber">
          <p className="text-[13px] text-amber">⚠ Low confidence: fewer than 5 feedback events. AI outputs are still bootstrapping. Approve/reject more outputs to improve accuracy.</p>
        </MCCard>
      )}

      {/* Brand details */}
      {selectedBrand && (
        <MCCard className="p-5 mb-4" topBorder={selectedBrand.brand_color_primary ?? undefined}>
          <h3 className="serif text-[20px] text-ink mb-2">{selectedBrand.name}</h3>
          <p className="text-[13px] text-ink-muted mb-4">{selectedBrand.description}</p>
          <div className="flex gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded" style={{ background: selectedBrand.brand_color_primary ?? "#ccc" }} />
              <span className="text-[12px] text-ink-muted">Primary</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded" style={{ background: selectedBrand.brand_color_accent ?? "#ccc" }} />
              <span className="text-[12px] text-ink-muted">Accent</span>
            </div>
          </div>
        </MCCard>
      )}

      {/* Voice profile editor */}
      {profile && <VoiceProfileEditor profile={profile} onSave={() => qc.invalidateQueries({ queryKey: ["brand-voice-profile"] })} />}

      {/* Bootstrap button */}
      <MCCard className="p-5 mb-4">
        <h3 className="serif text-[18px] text-ink mb-2">Bootstrap from Existing Data</h3>
        <p className="text-[13px] text-ink-muted mb-4">
          Pull top-performing LinkedIn posts and YouTube titles to seed approved examples. This gives the AI a head start on understanding {selectedBrand?.name}'s voice.
        </p>
        <button onClick={handleBootstrap} className="rounded-lg bg-gold px-6 py-2.5 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors">
          Bootstrap from Existing Data
        </button>
      </MCCard>
    </PageShell>
  );
}

function VoiceProfileEditor({ profile, onSave }: { profile: any; onSave: () => void }) {
  const [voiceSummary, setVoiceSummary] = useState(profile.voice_summary ?? "");
  const [toneInput, setToneInput] = useState((profile.tone_descriptors as string[])?.join(", ") ?? "");
  const [bannedInput, setBannedInput] = useState((profile.banned_phrases as string[])?.join(", ") ?? "");
  const [audience, setAudience] = useState(profile.audience_profile ?? "");
  const [thumbRules, setThumbRules] = useState(profile.thumbnail_style_rules ?? "");
  const [saving, setSaving] = useState(false);

  const approvedTitles = (profile.approved_title_examples as any[]) ?? [];
  const rejectedTitles = (profile.rejected_title_examples as any[]) ?? [];

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase.from("brand_voice_profiles").update({
        voice_summary: voiceSummary,
        tone_descriptors: toneInput.split(",").map((s: string) => s.trim()).filter(Boolean),
        banned_phrases: bannedInput.split(",").map((s: string) => s.trim()).filter(Boolean),
        audience_profile: audience,
        thumbnail_style_rules: thumbRules,
      }).eq("id", profile.id);
      if (error) throw error;
      toast.success("Voice profile updated.");
      onSave();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <MCCard className="p-5 mb-4">
      <h3 className="serif text-[18px] text-ink mb-4">Voice Profile</h3>

      <div className="space-y-4">
        <div>
          <label className="label-eyebrow block mb-2">Voice Summary</label>
          <textarea className={inputCls + " min-h-[100px]"} value={voiceSummary} onChange={(e) => setVoiceSummary(e.target.value)} />
        </div>

        <div>
          <label className="label-eyebrow block mb-2">Tone Descriptors (comma-separated)</label>
          <input className={inputCls} value={toneInput} onChange={(e) => setToneInput(e.target.value)} placeholder="warm, direct, soulful" />
        </div>

        <div>
          <label className="label-eyebrow block mb-2">Banned Phrases (comma-separated)</label>
          <textarea className={inputCls + " min-h-[60px]"} value={bannedInput} onChange={(e) => setBannedInput(e.target.value)} placeholder="unlock your potential, game-changing" />
        </div>

        <div>
          <label className="label-eyebrow block mb-2">Audience Profile</label>
          <textarea className={inputCls + " min-h-[80px]"} value={audience} onChange={(e) => setAudience(e.target.value)} />
        </div>

        <div>
          <label className="label-eyebrow block mb-2">Thumbnail Style Rules</label>
          <textarea className={inputCls + " min-h-[80px]"} value={thumbRules} onChange={(e) => setThumbRules(e.target.value)} />
        </div>

        {/* Approved examples (read-only view) */}
        {approvedTitles.length > 0 && (
          <div>
            <label className="label-eyebrow block mb-2">Approved Title Examples ({approvedTitles.length})</label>
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {approvedTitles.slice(0, 20).map((ex: any, i: number) => (
                <div key={i} className="p-2 bg-sage-bg rounded text-[12px] text-sage">
                  <span className="font-medium">{ex.title}</span>
                  {ex.reason && <span className="text-ink-muted ml-2">— {ex.reason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rejected examples (read-only view) */}
        {rejectedTitles.length > 0 && (
          <div>
            <label className="label-eyebrow block mb-2">Rejected Examples ({rejectedTitles.length})</label>
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {rejectedTitles.map((ex: any, i: number) => (
                <div key={i} className="p-2 bg-burgundy-bg rounded text-[12px] text-burgundy">
                  <span className="font-medium">{ex.title}</span>
                  {ex.reason && <span className="text-ink-muted ml-2">— {ex.reason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-gold px-6 py-2.5 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors disabled:opacity-60">
            {saving ? "Saving…" : "Save Voice Profile"}
          </button>
        </div>
      </div>
    </MCCard>
  );
}
