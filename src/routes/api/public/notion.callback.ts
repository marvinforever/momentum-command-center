// OAuth callback for Notion. Notion redirects here with ?code=... after the user authorizes.
// We exchange the code for an access_token and persist a notion_connections row.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { exchangeOAuthCode } from "@/server/notion";

export const Route = createFileRoute("/api/public/notion/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          return html(
            `<h1>Notion authorization failed</h1><p>${escapeHtml(error)}</p><p><a href="/admin/integrations">Back to Integrations</a></p>`,
            400,
          );
        }
        if (!code) {
          return html(
            `<h1>Missing authorization code</h1><p><a href="/admin/integrations">Back to Integrations</a></p>`,
            400,
          );
        }

        // Reconstruct the exact redirect_uri that was used to start the flow
        const redirectUri = `${url.origin}/api/public/notion/callback`;

        try {
          const token = await exchangeOAuthCode(code, redirectUri);

          await supabaseAdmin
            .from("notion_connections")
            .upsert(
              {
                workspace_id: token.workspace_id,
                workspace_name: token.workspace_name ?? null,
                workspace_icon: token.workspace_icon ?? null,
                bot_id: token.bot_id ?? null,
                access_token: token.access_token,
                owner_info: (token.owner ?? null) as never,
                enabled: true,
              },
              { onConflict: "workspace_id" },
            );

          // Redirect back to the integrations page
          return new Response(null, {
            status: 303,
            headers: { Location: "/admin/integrations?notion=connected" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return html(
            `<h1>Notion connection failed</h1><pre style="white-space:pre-wrap">${escapeHtml(msg)}</pre><p><a href="/admin/integrations">Back to Integrations</a></p>`,
            500,
          );
        }
      },
    },
  },
});

function html(body: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Notion</title><style>body{font-family:system-ui;max-width:640px;margin:60px auto;padding:0 20px;color:#1c1917}</style></head><body>${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
