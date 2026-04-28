import { Link } from "@tanstack/react-router";
import { useDueFollowUps, useCompleteFollowUp } from "@/lib/queries-v2";
import { fmtDateShort } from "@/lib/format";
import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function TodayPanel() {
  const dueQ = useDueFollowUps();
  const complete = useCompleteFollowUp();

  const items = (dueQ.data ?? []) as any[];
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = items.filter((i) => i.due_date < today).length;

  if (dueQ.isLoading) return null;
  if (items.length === 0) return null;

  return (
    <div className="mc-card p-4 mb-5 border-l-4 border-l-gold">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-gold" />
          <span className="text-[12px] uppercase tracking-[0.16em] text-ink font-medium">
            Today · {items.length} follow-up{items.length === 1 ? "" : "s"} due
            {overdueCount > 0 && <span className="text-burgundy ml-1">({overdueCount} overdue)</span>}
          </span>
        </div>
        <Link to="/crm" className="text-[11px] text-ink-muted hover:text-gold uppercase tracking-wider">
          CRM →
        </Link>
      </div>
      <div className="space-y-1.5">
        {items.slice(0, 6).map((f) => {
          const overdue = f.due_date < today;
          return (
            <div key={f.id} className="flex items-center gap-2 text-sm">
              <button
                onClick={(e) => { e.preventDefault(); complete.mutate({ id: f.id, contact_id: f.contact_id }); }}
                className="p-0.5 border border-line rounded hover:bg-sage hover:text-white hover:border-sage shrink-0"
                title="Mark complete"
              >
                <Check className="h-3 w-3" />
              </button>
              <span className={cn("text-[11px] tabular-nums shrink-0", overdue ? "text-burgundy font-medium" : "text-ink-muted")}>
                {fmtDateShort(f.due_date)}
              </span>
              <Link
                to="/crm/$id"
                params={{ id: f.contact_id }}
                className="text-ink hover:text-gold truncate flex-1"
              >
                <span className="font-medium">{f.contacts?.name ?? "Contact"}</span>
                <span className="text-ink-soft"> · {f.description}</span>
              </Link>
            </div>
          );
        })}
        {items.length > 6 && (
          <div className="text-[11px] text-ink-muted pt-1">
            +{items.length - 6} more
          </div>
        )}
      </div>
    </div>
  );
}
