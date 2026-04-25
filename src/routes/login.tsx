import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Momentum Command Center" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 mc-fade-in">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="serif text-[36px] leading-none text-ink">Momentum Command Center</h1>
          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
            Internal access only
          </p>
        </div>
        <div className="mc-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-eyebrow block mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line bg-cream px-4 py-3 text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30 transition"
                placeholder="you@themomentumcompany.com"
              />
            </div>
            <div>
              <label className="label-eyebrow block mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-line bg-cream px-4 py-3 text-[14px] text-ink focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30 transition"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-gold px-4 py-3 text-[14px] font-medium text-white hover:bg-gold/90 transition-colors disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-[11px] text-ink-muted">
          Need access? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
