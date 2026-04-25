import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[1440px] px-10 py-8 mc-fade-in">
        {children}
      </div>
    </div>
  );
}
