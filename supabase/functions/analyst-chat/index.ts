// Momentum Analyst — chat agent backed by Lovable AI with a read-only SQL tool.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCHEMA_DOC = `
You are "Momentum Analyst" — an in-app data analyst for The Momentum Company's marketing analytics dashboard.
You have read-only access to a Postgres database via the run_sql tool. Always ground answers in real data — call the tool before answering quantitative questions.

# Tables (Postgres, public schema)
- leads(id, email, first_name, last_name, source, lead_magnet_id, campaign_id, created_at, status, ...)
- lead_magnets(id, name, slug, ...)
- campaigns(id, name, type, primary_channel, status, budget, spend_to_date, lead_goal, booking_goal, start_date, end_date)
- discovery_calls(id, lead_id, scheduled_at, status, outcome, created_at)
- kajabi_form_submissions(id, form_name, form_id, email, first_name, last_name, submitted_at, payload, created_at)
- kajabi_purchases(id, email, offer_name, offer_id, amount_cents, purchased_at, created_at)
- meta_ads(id, ad_id, ad_name, campaign_name, adset_name, status)
- meta_ads_daily(ad_id, date, spend, impressions, clicks, leads, ctr, cpc, cpm)
- meta_campaigns(id, campaign_id, campaign_name, objective, status)
- meta_adsets(id, adset_id, adset_name, campaign_id)
- meta_ads_insights_daily(date, campaign_id, adset_id, ad_id, spend, impressions, clicks, leads, results)
- youtube_channels(id, channel_id, title, subscribers, views, videos)
- linkedin_posts(id, post_id, posted_at, impressions, clicks, likes, comments, shares)
- linkedin_weekly_metrics(week_start, followers, impressions, engagement_rate)
- channel_metrics(channel, account_label, followers_subs, ctr, avg_watch_time, ...)
- content(id, title, channel, published_at, ...)
- lead_content(lead_id, content_id)
- offers(id, name, price_cents)

# Tool usage rules
- Use run_sql for ANY question requiring numbers, lists, or trends. Do not guess.
- Only SELECT queries. No mutations. Always add LIMIT (default 100) unless aggregating.
- Use submitted_at for kajabi_form_submissions and purchased_at for kajabi_purchases — these are the true historical timestamps.
- Use date for meta_ads_daily / meta_ads_insights_daily.
- Prefer aggregations (COUNT, SUM, date_trunc) over raw row dumps.
- When the user asks vague time ranges, default to "last 30 days".
- After the tool returns, summarize findings in plain English with key numbers, then offer one or two follow-up questions.

# Style
- Concise, direct, marketing-savvy. Use bullet points and bold key numbers.
- Format currency with $ and commas. Format rates as percentages.
- Never expose raw SQL unless the user asks.
`;

async function runSqlTool(sql: string) {
  // Safety: only allow SELECT / WITH ... SELECT
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  const lower = trimmed.toLowerCase();
  if (!(lower.startsWith("select") || lower.startsWith("with"))) {
    return { error: "Only SELECT queries are allowed." };
  }
  if (/\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i.test(trimmed)) {
    return { error: "Mutations are not allowed." };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Use rpc to a generic exec function if available; otherwise fall back to PostgREST per-table is not flexible.
  // We'll create/use a SECURITY DEFINER function `analyst_run_sql(query text)` returning jsonb.
  const { data, error } = await supabase.rpc("analyst_run_sql", { query: trimmed });
  if (error) return { error: error.message };
  return { rows: data };
}

const tools = [
  {
    type: "function",
    function: {
      name: "run_sql",
      description:
        "Execute a read-only SELECT query against the analytics Postgres database and return rows as JSON. Always include a LIMIT unless aggregating.",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "A single SELECT (or WITH ... SELECT) SQL statement.",
          },
        },
        required: ["sql"],
        additionalProperties: false,
      },
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const convo: any[] = [
      { role: "system", content: SCHEMA_DOC },
      ...messages,
    ];

    // Agent loop — up to 5 tool iterations
    for (let i = 0; i < 5; i++) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: convo,
          tools,
        }),
      });

      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!resp.ok) {
        const t = await resp.text();
        console.error("AI error", resp.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error("No message in AI response");

      convo.push(msg);

      const toolCalls = msg.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        return new Response(JSON.stringify({ reply: msg.content ?? "" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (const call of toolCalls) {
        let result: any;
        if (call.function.name === "run_sql") {
          const args = JSON.parse(call.function.arguments || "{}");
          console.log("run_sql:", args.sql);
          result = await runSqlTool(args.sql);
        } else {
          result = { error: `Unknown tool ${call.function.name}` };
        }
        convo.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 12000),
        });
      }
    }

    return new Response(JSON.stringify({ reply: "I hit my reasoning step limit. Try rephrasing the question." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
