import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { PlatformChip } from "@/components/platform-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { usePosts, usePostWorkflow, useInvalidateWorkspaceData, type Post } from "@/lib/data";
import { canApprove, canEdit, useWorkspace } from "@/lib/workspace";
import { publishPost } from "@/lib/buffer.functions";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approval Queue | Social Command Centre" },
      {
        name: "description",
        content: "Review, approve, reject, schedule and publish posts. Nothing publishes without approval.",
      },
      { property: "og:title", content: "Approval Queue | Social Command Centre" },
      { property: "og:description", content: "Governed approval workflow for Texcortech Systems." },
    ],
  }),
  component: Approvals,
});

function Approvals() {
  const { organization, role } = useWorkspace();
  const posts = usePosts(organization.id, ["draft", "pending_approval", "approved", "scheduled", "failed"]);
  const workflow = usePostWorkflow(organization.id);
  const invalidate = useInvalidateWorkspaceData();
  const publish = useServerFn(publishPost);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [scheduleAt, setScheduleAt] = useState<Record<string, string>>({});
  const [publishing, setPublishing] = useState<string | null>(null);

  const list = posts.data ?? [];
  const pending = list.filter((p) => p.status === "pending_approval");
  const rest = list.filter((p) => p.status !== "pending_approval");

  async function handlePublish(post: Post) {
    setPublishing(post.id);
    try {
      const result = (await publish({ data: { orgId: organization.id, postId: post.id } })) as {
        status: string;
        message: string;
      };
      if (result.status === "not_configured") toast.warning(result.message);
      else if (result.status === "published") toast.success(result.message);
      else toast.error(result.message);
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publishing failed");
    } finally {
      setPublishing(null);
    }
  }

  function renderCard(post: Post, showDecision: boolean) {
    return (
      <article key={post.id} className="panel p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold">{post.title}</h3>
            <p className="text-xs text-muted-foreground">
              {post.campaigns?.name ? `${post.campaigns.name} · ` : ""}
              updated {format(new Date(post.updated_at), "d MMM yyyy, HH:mm")}
              {post.scheduled_at ? ` · target ${format(new Date(post.scheduled_at), "d MMM HH:mm")}` : ""}
            </p>
          </div>
          <StatusBadge status={post.status} />
        </header>

        <div className="mt-4 space-y-3">
          {post.post_variants.map((variant) => (
            <div key={variant.id} className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <PlatformChip platform={variant.platform} />
                {variant.channel_id ? null : (
                  <span className="text-xs text-warning-foreground">no connected channel</span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{variant.body}</p>
              {variant.cta ? <p className="mt-2 text-sm font-medium">{variant.cta}</p> : null}
              {variant.hashtags.length > 0 ? (
                <p className="mt-1 text-xs text-primary">{variant.hashtags.join(" ")}</p>
              ) : null}
              {variant.media_reference ? (
                <p className="mt-1 text-xs text-muted-foreground">Media: {variant.media_reference}</p>
              ) : null}
            </div>
          ))}
        </div>

        <footer className="mt-4 space-y-3 border-t border-border pt-4">
          {post.status === "draft" && canEdit(role) ? (
            <Button
              size="sm"
              onClick={() => {
                workflow.submitForApproval.mutate(post.id, {
                  onSuccess: () => toast.success("Sent for approval"),
                  onError: (error) => toast.error(error.message),
                });
              }}
              disabled={workflow.submitForApproval.isPending}
            >
              <Send className="size-4" /> Submit for approval
            </Button>
          ) : null}

          {showDecision && canApprove(role) ? (
            <div className="space-y-2">
              <Label htmlFor={`note-${post.id}`}>Reviewer note (optional)</Label>
              <Textarea
                id={`note-${post.id}`}
                rows={2}
                value={notes[post.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [post.id]: e.target.value }))}
                placeholder="Brand, compliance or copy feedback…"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    workflow.decide.mutate(
                      { postId: post.id, approve: true, note: notes[post.id] ?? "" },
                      {
                        onSuccess: () => toast.success("Approved"),
                        onError: (error) => toast.error(error.message),
                      },
                    )
                  }
                  disabled={workflow.decide.isPending}
                >
                  <ThumbsUp className="size-4" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    workflow.decide.mutate(
                      { postId: post.id, approve: false, note: notes[post.id] ?? "" },
                      {
                        onSuccess: () => toast.success("Returned to draft"),
                        onError: (error) => toast.error(error.message),
                      },
                    )
                  }
                  disabled={workflow.decide.isPending}
                >
                  <ThumbsDown className="size-4" /> Request changes
                </Button>
              </div>
            </div>
          ) : null}

          {showDecision && !canApprove(role) ? (
            <p className="text-xs text-muted-foreground">
              Waiting on an approver. Your role can submit content but not approve it.
            </p>
          ) : null}

          {post.status === "approved" && canEdit(role) ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor={`sched-${post.id}`}>Schedule for</Label>
                <Input
                  id={`sched-${post.id}`}
                  type="datetime-local"
                  className="w-56"
                  value={scheduleAt[post.id] ?? (post.scheduled_at ? post.scheduled_at.slice(0, 16) : "")}
                  onChange={(e) => setScheduleAt((s) => ({ ...s, [post.id]: e.target.value }))}
                />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  const value = scheduleAt[post.id] ?? (post.scheduled_at ? post.scheduled_at.slice(0, 16) : "");
                  if (!value) {
                    toast.error("Pick a date and time");
                    return;
                  }
                  workflow.schedule.mutate(
                    { postId: post.id, scheduledAt: new Date(value).toISOString() },
                    {
                      onSuccess: () => toast.success("Scheduled"),
                      onError: (error) => toast.error(error.message),
                    },
                  );
                }}
                disabled={workflow.schedule.isPending}
              >
                Schedule
              </Button>
            </div>
          ) : null}

          {(post.status === "approved" || post.status === "scheduled") && canApprove(role) ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handlePublish(post)}
              disabled={publishing === post.id}
            >
              {publishing === post.id ? <Loader2 className="size-4 animate-spin" /> : null}
              Publish now via Buffer
            </Button>
          ) : null}
        </footer>
      </article>
    );
  }

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        description="Draft → Pending approval → Approved → Scheduled → Published. External publishing requires explicit approval."
        actions={
          <Button asChild variant="outline">
            <Link to="/composer">New post</Link>
          </Button>
        }
      />

      {posts.error ? (
        <ErrorState description={posts.error instanceof Error ? posts.error.message : undefined} />
      ) : null}

      {posts.isPending ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="size-6" />}
          title="Queue is clear"
          description="No drafts or pending posts. Compose something to get started."
          action={
            <Button asChild size="sm">
              <Link to="/composer">Open composer</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-eyebrow mb-3">Awaiting approval ({pending.length})</h2>
            {pending.length === 0 ? (
              <EmptyState title="Nothing awaiting approval" />
            ) : (
              <div className="space-y-4">{pending.map((post) => renderCard(post, true))}</div>
            )}
          </section>
          <section>
            <h2 className="text-eyebrow mb-3">Everything else ({rest.length})</h2>
            <div className="space-y-4">{rest.map((post) => renderCard(post, false))}</div>
          </section>
        </div>
      )}
    </div>
  );
}
