import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity as ActivityIcon,
  CalendarClock,
  CheckCircle2,
  FileText,
  Radio,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { PageHeader } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { PlatformChip } from "@/components/platform-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivity, useChannels, useConnection, usePosts } from "@/lib/data";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Overview | Social Command Centre" },
      {
        name: "description",
        content: "Connected channels, scheduled posts, drafts, approval queue and publishing activity.",
      },
      { property: "og:title", content: "Overview | Social Command Centre" },
      { property: "og:description", content: "Social operations overview for Texcortech Systems." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { organization } = useWorkspace();
  const channels = useChannels(organization.id);
  const connection = useConnection(organization.id);
  const posts = usePosts(organization.id);
  const activity = useActivity(organization.id, 8);

  const all = posts.data ?? [];
  const drafts = all.filter((p) => p.status === "draft");
  const pending = all.filter((p) => p.status === "pending_approval");
  const scheduled = all.filter((p) => p.status === "scheduled");
  const published = all.filter((p) => p.status === "published");
  const upcoming = [...scheduled]
    .filter((p) => p.scheduled_at)
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Live state of your social operations across every connected channel."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/channels">Manage channels</Link>
            </Button>
            <Button asChild>
              <Link to="/composer">New campaign post</Link>
            </Button>
          </>
        }
      />

      {posts.error ? (
        <ErrorState description={posts.error instanceof Error ? posts.error.message : undefined} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Connected channels"
          value={channels.data?.length ?? 0}
          hint={
            connection.data?.status === "connected"
              ? "Buffer connected"
              : connection.data?.status === "error"
                ? "Buffer connection error"
                : "Buffer not configured"
          }
          icon={<Radio className="size-4" />}
          loading={channels.isPending}
        />
        <StatCard
          label="Scheduled posts"
          value={scheduled.length}
          hint="Approved and queued"
          icon={<CalendarClock className="size-4" />}
          loading={posts.isPending}
        />
        <StatCard
          label="Drafts"
          value={drafts.length}
          hint="Work in progress"
          icon={<FileText className="size-4" />}
          loading={posts.isPending}
        />
        <StatCard
          label="Awaiting approval"
          value={pending.length}
          hint="Blocked until approved"
          icon={<CheckCircle2 className="size-4" />}
          loading={posts.isPending}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="panel xl:col-span-2">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-sm font-semibold">Upcoming schedule</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/calendar">Open schedule</Link>
            </Button>
          </header>
          <div className="p-5">
            {posts.isPending ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="size-6" />}
                title="Nothing scheduled yet"
                description="Approved posts appear here once a publish time is set."
                action={
                  <Button asChild size="sm">
                    <Link to="/composer">Compose a post</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((post) => (
                  <li key={post.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{post.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.scheduled_at
                          ? format(new Date(post.scheduled_at), "EEE d MMM yyyy, HH:mm")
                          : "No time set"}
                        {post.campaigns?.name ? ` · ${post.campaigns.name}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {post.post_variants.map((v) => (
                        <PlatformChip key={v.id} platform={v.platform} />
                      ))}
                    </div>
                    <StatusBadge status={post.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="panel">
          <header className="border-b border-border px-5 py-4">
            <h2 className="font-display text-sm font-semibold">Performance</h2>
          </header>
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-4">
              <TrendingUp className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Analytics coming next</p>
                <p className="text-xs text-muted-foreground">
                  Reach, engagement and click-through will populate once posts publish through Buffer.
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Published", published.length],
                ["Failed", all.filter((p) => p.status === "failed").length],
                ["Reach", "—"],
                ["Engagement", "—"],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-muted/50 p-3">
                  <dt className="text-eyebrow">{label}</dt>
                  <dd className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </div>

      <section className="panel mt-6">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-sm font-semibold">Recent activity</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/activity">Full audit log</Link>
          </Button>
        </header>
        <div className="p-5">
          {activity.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (activity.data ?? []).length === 0 ? (
            <EmptyState
              icon={<ActivityIcon className="size-6" />}
              title="No activity recorded yet"
              description="Every action — drafting, approving, scheduling, publishing — is logged here."
            />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {(activity.data ?? []).map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <span className="font-medium">{entry.action}</span>
                  <span className="text-muted-foreground">{entry.actor_email ?? "system"}</span>
                  <span
                    className={
                      entry.result === "success"
                        ? "text-xs font-medium text-success"
                        : "text-xs font-medium text-destructive"
                    }
                  >
                    {entry.result}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {format(new Date(entry.created_at), "d MMM HH:mm")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
