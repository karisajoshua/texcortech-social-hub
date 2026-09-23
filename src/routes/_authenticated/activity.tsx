import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity as ActivityIcon } from "lucide-react";
import { format } from "date-fns";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivity, useChannels } from "@/lib/data";
import { platformLabel } from "@/lib/constants";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log | Social Command Centre" },
      {
        name: "description",
        content: "Immutable audit trail of who did what, when, on which channel, and with what result.",
      },
      { property: "og:title", content: "Activity Log | Social Command Centre" },
      { property: "og:description", content: "Full audit trail for Texcortech Systems social operations." },
    ],
  }),
  component: ActivityLog,
});

function ActivityLog() {
  const { organization } = useWorkspace();
  const activity = useActivity(organization.id, 200);
  const channels = useChannels(organization.id);
  const [filter, setFilter] = useState("");

  const channelName = new Map(
    (channels.data ?? []).map((c) => [c.id, c.display_name ?? c.handle ?? platformLabel(c.platform)]),
  );

  const rows = (activity.data ?? []).filter((entry) => {
    if (!filter.trim()) return true;
    const needle = filter.toLowerCase();
    return (
      entry.action.toLowerCase().includes(needle) ||
      (entry.actor_email ?? "").toLowerCase().includes(needle) ||
      entry.result.toLowerCase().includes(needle)
    );
  });

  return (
    <div>
      <PageHeader
        title="Activity & Audit Log"
        description="Every action is recorded with actor, timestamp, channel, post and result."
        actions={
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by action, actor or result"
            className="w-64"
          />
        }
      />

      {activity.error ? (
        <ErrorState description={activity.error instanceof Error ? activity.error.message : undefined} />
      ) : null}

      <section className="panel overflow-hidden">
        {activity.isPending ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<ActivityIcon className="size-6" />}
              title={filter ? "No matching entries" : "No activity yet"}
              description={
                filter
                  ? "Try a different search term."
                  : "Drafting, approvals, scheduling, channel syncs and publishing all appear here."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr className="text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Actor</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Entity</th>
                  <th className="px-5 py-3 font-medium">Channel</th>
                  <th className="px-5 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-muted-foreground">
                      {format(new Date(entry.created_at), "d MMM yyyy HH:mm:ss")}
                    </td>
                    <td className="px-5 py-3">{entry.actor_email ?? "system"}</td>
                    <td className="px-5 py-3 font-medium">{entry.action}</td>
                    <td className="px-5 py-3 text-muted-foreground">{entry.entity_type ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {entry.channel_id ? (channelName.get(entry.channel_id) ?? "channel") : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          entry.result === "success"
                            ? "bg-success/15 text-success"
                            : "bg-destructive/12 text-destructive",
                        )}
                      >
                        {entry.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
