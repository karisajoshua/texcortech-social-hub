import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { PlatformIcon } from "@/components/platform-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePosts } from "@/lib/data";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Schedule | Social Command Centre" },
      {
        name: "description",
        content: "Unified publishing calendar across every connected social channel.",
      },
      { property: "og:title", content: "Schedule | Social Command Centre" },
      { property: "og:description", content: "Unified publishing calendar for Texcortech Systems." },
    ],
  }),
  component: CalendarView,
});

function CalendarView() {
  const { organization } = useWorkspace();
  const posts = usePosts(organization.id, ["scheduled", "approved", "published", "failed"]);
  const [cursor, setCursor] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const scheduled = (posts.data ?? []).filter((post) => post.scheduled_at);
  const upcoming = [...scheduled].sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));

  return (
    <div>
      <PageHeader
        title="Schedule"
        description="Every approved and published item, on one calendar."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(subMonths(cursor, 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-36 text-center font-display text-sm font-semibold">
              {format(cursor, "MMMM yyyy")}
            </span>
            <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      {posts.error ? (
        <ErrorState description={posts.error instanceof Error ? posts.error.message : undefined} />
      ) : null}

      {posts.isPending ? (
        <Skeleton className="h-[32rem] w-full" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-4">
          <section className="panel overflow-hidden xl:col-span-3">
            <div className="grid grid-cols-7 border-b border-border bg-muted/50">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const items = scheduled.filter((post) => isSameDay(new Date(post.scheduled_at!), day));
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-24 border-b border-r border-border p-2 last:border-r-0",
                      !isSameMonth(day, cursor) && "bg-muted/30",
                      isSameDay(day, new Date()) && "bg-primary/5",
                    )}
                  >
                    <p
                      className={cn(
                        "text-xs font-medium tabular-nums",
                        isSameMonth(day, cursor) ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </p>
                    <div className="mt-1 space-y-1">
                      {items.map((post) => (
                        <div
                          key={post.id}
                          className="rounded-md border border-border bg-card px-1.5 py-1 text-[11px] leading-tight shadow-xs"
                          title={post.title}
                        >
                          <div className="flex items-center gap-1">
                            {post.post_variants.slice(0, 3).map((v) => (
                              <PlatformIcon key={v.id} platform={v.platform} className="size-3" />
                            ))}
                            <span className="ml-auto tabular-nums text-muted-foreground">
                              {format(new Date(post.scheduled_at!), "HH:mm")}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate font-medium">{post.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <header className="border-b border-border px-5 py-4">
              <h2 className="font-display text-sm font-semibold">Queue</h2>
            </header>
            <div className="p-5">
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="size-6" />}
                  title="Nothing scheduled"
                  description="Approve a post and set a publish time to fill the calendar."
                  action={
                    <Button asChild size="sm">
                      <Link to="/approvals">Open approvals</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((post) => (
                    <li key={post.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-medium">{post.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {format(new Date(post.scheduled_at!), "EEE d MMM, HH:mm")}
                      </p>
                      <div className="mt-2">
                        <StatusBadge status={post.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
