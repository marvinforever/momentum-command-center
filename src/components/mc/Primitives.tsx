import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function MCCard({
  children,
  className,
  hoverable,
  topBorder,
  ...props
}: HTMLAttributes<HTMLDivElement> & { hoverable?: boolean; topBorder?: string }) {
  return (
    <div
      className={cn(
        "mc-card relative overflow-hidden",
        hoverable && "mc-card-hover",
        className,
      )}
      {...props}
    >
      {topBorder && <div className="absolute inset-x-0 top-0 h-[4px]" style={{ background: topBorder }} />}
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  meta,
  className,
}: { title: string; meta?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-3 sm:mb-4", className)}>
      <h2 className="serif text-[20px] sm:text-[24px] leading-tight text-ink">{title}</h2>
      {meta && <div className="label-eyebrow">{meta}</div>}
    </div>
  );
}

export function CardHeader({
  title,
  meta,
}: { title: string; meta?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b border-line-soft px-4 py-3 sm:px-6 sm:py-4">
      <h3 className="serif text-[17px] sm:text-[20px] leading-tight text-ink">{title}</h3>
      {meta && <div className="label-eyebrow">{meta}</div>}
    </div>
  );
}

export function StatusPill({ label, tone = "sage" }: { label: string; tone?: "sage" | "gold" | "burgundy" | "amber" | "navy" | "muted" }) {
  const tones: Record<string, string> = {
    sage: "bg-sage-bg text-sage",
    gold: "bg-gold-bg text-gold",
    burgundy: "bg-burgundy-bg text-burgundy",
    amber: "bg-amber-bg text-amber",
    navy: "bg-navy-bg text-navy",
    muted: "bg-cream-deep text-ink-muted",
  };
  const dotTone: Record<string, string> = {
    sage: "bg-sage",
    gold: "bg-gold",
    burgundy: "bg-burgundy",
    amber: "bg-amber",
    navy: "bg-navy",
    muted: "bg-ink-muted",
  };
  return (
    <span className={cn("mc-pill", tones[tone])}>
      <span className={cn("h-1.5 w-1.5 rounded-full mc-pulse", dotTone[tone])} />
      {label}
    </span>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  const styles: Record<string, string> = {
    YouTube: "bg-gold-bg text-gold",
    "YouTube Short": "bg-gold-bg text-gold",
    LinkedIn: "bg-navy-bg text-navy",
    "LinkedIn · Organic": "bg-navy-bg text-navy",
    Instagram: "bg-burgundy-bg text-burgundy",
    Podcast: "bg-sage-bg text-sage",
    Newsletter: "bg-cream-deep text-ink-soft",
    "Email/Kajabi": "bg-cream-deep text-ink-soft",
    Email: "bg-cream-deep text-ink-soft",
    Blog: "bg-cream-deep text-ink-soft",
    "Multi-Channel": "bg-cream-deep text-ink-soft",
    "Meta Ads": "bg-amber-bg text-amber",
    "Paid · Meta": "bg-amber-bg text-amber",
    Facebook: "bg-navy-bg text-navy",
    "Twitter/X": "bg-cream-deep text-ink-soft",
    Other: "bg-cream-deep text-ink-muted",
    "YouTube · Organic": "bg-gold-bg text-gold",
  };
  return <span className={cn("mc-tag", styles[channel] ?? "bg-cream-deep text-ink-muted")}>{channel}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "sage" | "gold" | "burgundy" | "amber" | "muted" | "navy"> = {
    Live: "sage",
    Warming: "gold",
    Paused: "muted",
    Planning: "navy",
    Completed: "muted",
    Pending: "gold",
    Won: "sage",
    Enrolled: "sage",
    Lost: "muted",
    "Not a Fit": "muted",
    New: "amber",
    Nurturing: "gold",
    "Booked Call": "navy",
    "Held Call": "sage",
    "Sold Out": "burgundy",
    Active: "sage",
    Retired: "muted",
  };
  return <StatusPill label={status} tone={map[status] ?? "muted"} />;
}

export function Avatar({ name, idx = 0 }: { name: string; idx?: number }) {
  const colors = [
    "bg-gold text-white",
    "bg-sage text-white",
    "bg-burgundy text-white",
    "bg-navy text-white",
    "bg-amber text-white",
    "bg-ink-soft text-white",
  ];
  const init = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold tracking-wide",
        colors[idx % colors.length],
      )}
    >
      {init}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  trend,
  tone = "gold",
  size = "md",
  onClick,
  highlighted,
}: {
  label: string;
  value: ReactNode;
  trend?: ReactNode;
  tone?: "gold" | "sage" | "amber" | "burgundy" | "navy";
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  highlighted?: boolean;
}) {
  const toneColors: Record<string, string> = {
    gold: "var(--gold)",
    sage: "var(--sage)",
    amber: "var(--amber)",
    burgundy: "var(--burgundy)",
    navy: "var(--navy)",
  };
  const sizes: Record<string, string> = { sm: "text-[26px]", md: "text-[36px]", lg: "text-[42px]" };
  return (
    <div
      onClick={onClick}
      className={cn(
        "mc-card p-5",
        onClick && "mc-card-hover cursor-pointer",
        highlighted && "bg-cream-deep",
      )}
    >
      <div className="absolute inset-x-0 top-0 h-[4px]" style={{ background: toneColors[tone] }} />
      <div className="label-eyebrow">{label}</div>
      <div className={cn("num-serif mt-2 leading-none text-ink", sizes[size])}>{value}</div>
      {trend && <div className="mt-2 text-[11px] text-ink-muted">{trend}</div>}
    </div>
  );
}

export function Divider() {
  return <div className="h-px w-full bg-line-soft" />;
}
