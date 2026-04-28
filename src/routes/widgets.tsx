// Preserves the old widget-style dashboard at /widgets.
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { SectionTitle } from "@/components/mc/Primitives";
import { YouTubeWidget } from "@/components/mc/YouTubeWidget";
import { MetaAdsWidget } from "@/components/mc/MetaAdsWidget";
import { LinkedInWidget } from "@/components/mc/LinkedInWidget";
import { KajabiWidget } from "@/components/mc/KajabiWidget";
import { PodcastWidget } from "@/components/mc/PodcastWidget";

export const Route = createFileRoute("/widgets")({
  head: () => ({ meta: [{ title: "Channels — Momentum" }] }),
  component: WidgetsPage,
});

function WidgetsPage() {
  return (
    <PageShell>
      <div className="mb-5">
        <h1 className="serif text-[32px] lg:text-[40px] leading-none text-ink">Channels</h1>
        <p className="mt-1.5 text-[12px] uppercase tracking-[0.18em] text-ink-muted">
          Live channel widgets · Click any to drill down
        </p>
      </div>
      <SectionTitle title="Channels" meta="YouTube, Meta, LinkedIn, Kajabi, Podcast" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <YouTubeWidget />
        <MetaAdsWidget />
        <LinkedInWidget account="Christine" />
        <LinkedInWidget account="Mark" />
        <KajabiWidget />
        <PodcastWidget />
      </div>
    </PageShell>
  );
}
