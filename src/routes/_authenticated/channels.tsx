import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plug, RefreshCw, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { ConnectionBadge } from "@/components/status-badge";
import { PlatformIcon } from "@/components/platform-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORMS, platformLabel } from "@/lib/constants";
import { useChannels, useConnection, useInvalidateWorkspaceData } from "@/lib/data";
import { canManageIntegrations, useWorkspace } from "@/lib/workspace";
import { syncBufferChannels, testBufferConnection } from "@/lib/buffer.functions";

export const Route = createFileRoute("/_authenticated/channels")({
  head: () => ({
    meta: [
      { title: "Channels | Social Command Centre" },
      {
        name: "description",
        content: "Buffer connection status and the social channels available to this workspace.",
      },
      { property: "og:title", content: "Channels | Social Command Centre" },
      { property: "og:description", content: "Buffer integration status for Texcortech Systems." },
    ],
  }),
  component: Channels,
});

function Channels() {
  const { organization, role } = useWorkspace();
  const connection = useConnection(organization.id);
  const channels = useChannels(organization.id);
  const invalidate = useInvalidateWorkspaceData();
  const test = useServerFn(testBufferConnection);
  const sync = useServerFn(syncBufferChannels);
  const [busy, setBusy] = useState<"test" | "sync" | null>(null);

  const status = connection.data?.status ?? "not_configured";
  const configured = status === "connected";

  async function runTest() {
    setBusy("test");
    try {
      const result = (await test({ data: { orgId: organization.id } })) as {
        status: string;
        message: string;
      };
      if (result.status === "connected") toast.success(result.message);
      else if (result.status === "not_configured") toast.warning(result.message);
      else toast.error(result.message);
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection test failed");
    } finally {
      setBusy(null);
    }
  }

  async function runSync() {
    setBusy("sync");
    try {
      const result = (await sync({ data: { orgId: organization.id } })) as {
        status: string;
        message: string;
      };
      if (result.status === "connected") toast.success(result.message);
      else if (result.status === "not_configured") toast.warning(result.message);
      else toast.error(result.message);
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Channel sync failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Channels & Integrations"
        description="Publishing runs through Buffer from the server. Credentials never reach the browser."
        actions={
          canManageIntegrations(role) ? (
            <>
              <Button variant="outline" onClick={runTest} disabled={busy !== null}>
                {busy === "test" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                Test connection
              </Button>
              <Button onClick={runSync} disabled={busy !== null}>
                {busy === "sync" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Sync channels
              </Button>
            </>
          ) : null
        }
      />

      {connection.error ? (
        <ErrorState description={connection.error instanceof Error ? connection.error.message : undefined} />
      ) : null}

      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-eyebrow">Provider</p>
            <h2 className="mt-1 font-display text-lg font-semibold">Buffer</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Buffer brokers publishing to LinkedIn, Facebook, Instagram, X, TikTok, Threads and YouTube.
              The access token is read on the server from the <code className="rounded bg-muted px-1">BUFFER_ACCESS_TOKEN</code>{" "}
              secret.
            </p>
          </div>
          {connection.isPending ? <Skeleton className="h-6 w-40" /> : <ConnectionBadge status={status} />}
        </div>

        <dl className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
          <div>
            <dt className="text-eyebrow">Account</dt>
            <dd className="mt-1 text-sm">{connection.data?.external_account_email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-eyebrow">Last synced</dt>
            <dd className="mt-1 text-sm">
              {connection.data?.last_synced_at
                ? format(new Date(connection.data.last_synced_at), "d MMM yyyy, HH:mm")
                : "Never"}
            </dd>
          </div>
          <div>
            <dt className="text-eyebrow">Last error</dt>
            <dd className="mt-1 text-sm text-destructive">{connection.data?.last_error ?? "—"}</dd>
          </div>
        </dl>

        {!configured ? (
          <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm">
            <p className="font-medium">Buffer not configured</p>
            <p className="mt-1 text-muted-foreground">
              Ask a workspace administrator to add the <code className="rounded bg-muted px-1">BUFFER_ACCESS_TOKEN</code>{" "}
              secret in Project Settings → Secrets, then run “Test connection”. Drafting, approvals and
              scheduling all work without it — only external publishing is paused.
            </p>
          </div>
        ) : null}
      </section>

      <section className="panel mt-6">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-sm font-semibold">Connected profiles</h2>
          <span className="text-xs text-muted-foreground">{channels.data?.length ?? 0} channel(s)</span>
        </header>
        <div className="p-5">
          {channels.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (channels.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Plug className="size-6" />}
              title="No channels connected"
              description="Once Buffer is configured, sync to import the real profiles on the connected account. Nothing is assumed."
            />
          ) : (
            <ul className="divide-y divide-border">
              {(channels.data ?? []).map((channel) => (
                <li key={channel.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-secondary">
                    <PlatformIcon platform={channel.platform} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {channel.display_name ?? channel.handle ?? platformLabel(channel.platform)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {platformLabel(channel.platform)}
                      {channel.handle ? ` · @${channel.handle}` : ""}
                    </p>
                  </div>
                  <span
                    className={
                      channel.is_active
                        ? "text-xs font-medium text-success"
                        : "text-xs font-medium text-muted-foreground"
                    }
                  >
                    {channel.is_active ? "Active" : "Disabled"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="panel mt-6 p-5">
        <h2 className="font-display text-sm font-semibold">Supported platforms</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Availability depends on the profiles present on the connected Buffer account.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORMS.map((platform) => {
            const count = (channels.data ?? []).filter((c) => c.platform === platform).length;
            return (
              <div
                key={platform}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <PlatformIcon platform={platform} />
                <span className="flex-1 text-sm font-medium">{platformLabel(platform)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
