import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { LogOut, Home } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  rightStatus?: string;
  rightDate?: string;
  breadcrumbs?: { label: string; to?: string }[];
  rightSlot?: ReactNode;
}

export function PageHeader({ title, subtitle, rightStatus, rightDate, breadcrumbs, rightSlot }: PageHeaderProps) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";

  return (
    <header className="border-b border-line pb-5 mb-6 lg:pb-6 lg:mb-9">
      {!isHome && (
        <div className="mb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-ink-muted hover:text-gold transition-colors"
          >
            <Home className="h-3 w-3" />
            ← Back to Command Center
          </Link>
        </div>
      )}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-3 flex flex-wrap items-center gap-2 text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-ink-muted">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-2">
              {b.to ? (
                <Link to={b.to} className="hover:text-gold transition-colors">{b.label}</Link>
              ) : (
                <span className="text-ink">{b.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <span className="text-line">/</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="serif text-[28px] sm:text-[34px] lg:text-[42px] leading-tight lg:leading-none text-ink">{title}</h1>
          <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-[12px] uppercase tracking-[0.18em] text-ink-muted">{subtitle}</p>
        </div>
        <div className="flex flex-row items-center justify-between sm:flex-col sm:items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {rightStatus && (
              <span className="mc-pill bg-sage-bg text-sage">
                <span className="h-1.5 w-1.5 rounded-full bg-sage mc-pulse" />
                {rightStatus}
              </span>
            )}
            {rightDate && (
              <span className="mc-pill bg-cream-deep text-ink-soft hidden sm:inline-flex">
                {rightDate}
              </span>
            )}
          </div>
          {(user || rightSlot) && (
            <div className="flex items-center gap-3">
              {rightSlot}
              {user && (
                <button
                  onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
                  className="flex items-center gap-1.5 text-[11px] text-ink-muted hover:text-gold transition-colors"
                >
                  <LogOut className="h-3 w-3" />
                  Sign out
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
