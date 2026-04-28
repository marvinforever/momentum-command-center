import type { ReactNode } from "react";
import { TopNav } from "./TopNav";

export function PageShell({ children, fullBleed = false }: { children: ReactNode; fullBleed?: boolean }) {
  return (
    <div className="min-h-screen bg-cream">
      <TopNav />
      <div className={(fullBleed ? "" : "mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8 ") + " mc-fade-in"}>
        {children}
      </div>
    </div>
  );
}
