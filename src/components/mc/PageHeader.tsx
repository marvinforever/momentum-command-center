import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { LogOut } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  rightStatus?: string;
  rightDate?: string;
  breadcrumbs?: { label: string; to?: string }[];
}

export function PageHeader({ title, subtitle, rightStatus, rightDate, breadcrumbs }: PageHeaderProps) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-line pb-6 mb-9">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-ink-muted">
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
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="serif text-[42px] leading-none text-ink">{title}</h1>
          <p className="mt-2 text-[12px] uppercase tracking-[0.18em] text-ink-muted">{subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {rightStatus && (
              <span className="mc-pill bg-sage-bg text-sage">
                <span className="h-1.5 w-1.5 rounded-full bg-sage mc-pulse" />
                {rightStatus}
              </span>
            )}
            {rightDate && (
              <span className="mc-pill bg-cream-deep text-ink-soft">
                {rightDate}
              </span>
            )}
          </div>
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
      </div>
    </header>
  );
}
