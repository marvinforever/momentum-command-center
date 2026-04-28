import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { MetricsGrid } from "@/components/mc/MetricsGrid";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Momentum" }] }),
  component: Home,
});

function Home() {
  return (
    <PageShell>
      <div className="mb-5">
        <h1 className="serif text-[32px] lg:text-[40px] leading-none text-ink">Dashboard</h1>
        <p className="mt-1.5 text-[12px] uppercase tracking-[0.18em] text-ink-muted">
          Weekly historical view · Click any row to drill in
        </p>
      </div>
      <MetricsGrid />
    </PageShell>
  );
}
