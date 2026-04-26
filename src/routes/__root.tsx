import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts, useLocation, useNavigate } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="max-w-md text-center mc-fade-in">
        <h1 className="serif text-[80px] leading-none text-ink">404</h1>
        <h2 className="serif mt-4 text-2xl text-ink">Page not found</h2>
        <p className="mt-2 text-sm text-ink-muted">
          This page doesn't exist or has moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-gold px-5 py-2.5 text-sm font-medium text-white hover:bg-gold/90 transition-colors"
          >
            Return to Command Center
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Momentum Analytics" },
      { name: "description", content: "Marketing operations dashboard for The Momentum Company." },
      { property: "og:title", content: "Momentum Analytics" },
      { name: "twitter:title", content: "Momentum Analytics" },
      { property: "og:description", content: "Marketing operations dashboard for The Momentum Company." },
      { name: "twitter:description", content: "Marketing operations dashboard for The Momentum Company." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/yTaRa6EIFzZvoQz2U5yJN1orge43/social-images/social-1777205516723-Icon_Black.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/yTaRa6EIFzZvoQz2U5yJN1orge43/social-images/social-1777205516723-Icon_Black.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <Outlet />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--paper)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
                fontFamily: "var(--font-sans)",
              },
            }}
          />
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isLogin = location.pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!user && !isLogin) {
      navigate({ to: "/login" });
    } else if (user && isLogin) {
      navigate({ to: "/" });
    }
  }, [user, loading, isLogin, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="serif text-2xl text-ink-muted mc-pulse">Momentum</div>
      </div>
    );
  }

  if (!user && !isLogin) return null;
  return <>{children}</>;
}
