import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

const ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/crm", label: "Pipeline" },
  { to: "/contacts", label: "Contacts" },
  { to: "/widgets", label: "Channels" },
  { to: "/admin", label: "Admin" },
] as const;

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  return (
    <nav className="border-b border-line bg-paper/70 backdrop-blur-sm sticky top-0 z-30">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 flex items-center justify-between h-12">
        <div className="flex items-center gap-1">
          <Link to="/" className="serif text-[18px] text-ink mr-4">
            Momentum
          </Link>
          <div className="flex items-center gap-1">
            {ITEMS.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                className={
                  "px-3 py-1.5 rounded-md text-[12px] uppercase tracking-[0.14em] transition-colors " +
                  (isActive(it.to)
                    ? "bg-cream-deep text-ink"
                    : "text-ink-muted hover:text-ink hover:bg-cream-deep/60")
                }
              >
                {it.label}
              </Link>
            ))}
          </div>
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
    </nav>
  );
}
