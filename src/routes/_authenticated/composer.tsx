import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Plug, Send, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PlatformIcon } from "@/components/platform-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORMS, PLATFORM_LIMITS, platformLabel } from "@/lib/constants";
import { logActivity, useChannels, useInvalidateWorkspaceData } from "@/lib/data";
import { canEdit, useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/composer")({
  head: () => ({
    meta: [
      { title: "Content Composer | Social Command Centre" },
      {
        name: "description",
        content: "Compose one campaign post with platform-specific variants, hashtags, CTA and schedule.",
      },
      { property: "og:title", content: "Content Composer | Social Command Centre" },
      { property: "og:description", content: "Platform-specific campaign composer for Texcortech Systems." },
    ],
  }),
  component: Composer,
});

type VariantDraft = {
  body: string;
  hashtags: string;
  cta: string;
  media: string;
  channelId: string | null;
};

function emptyVariant(channelId: string | null): VariantDraft {
  return { body: "", hashtags: "", cta: "", media: "", channelId };
}

function Composer() {
  const { organization, role } = useWorkspace();
  const channels = useChannels(organization.id);
  const invalidate = useInvalidateWorkspaceData();
  const navigate = useNavigate();

  const [campaignName, setCampaignName] = useState("");
  const [title, setTitle] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [selected, setSelected] = useState<string[]>([]);
  const [variants, setVariants] = useState<Record<string, VariantDraft>>({});
  const [busy, setBusy] = useState<"draft" | "approval" | null>(null);

  const channelsByPlatform = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const channel of channels.data ?? []) {
      if (!map.has(channel.platform)) {
        map.set(channel.platform, {
          id: channel.id,
          label: channel.display_name ?? channel.handle ?? platformLabel(channel.platform),
        });
      }
    }
    return map;
  }, [channels.data]);

  function togglePlatform(platform: string) {
    setSelected((current) => {
      if (current.includes(platform)) return current.filter((p) => p !== platform);
      setVariants((v) => ({
        ...v,
        [platform]: v[platform] ?? emptyVariant(channelsByPlatform.get(platform)?.id ?? null),
      }));
      return [...current, platform];
    });
  }

  function updateVariant(platform: string, patch: Partial<VariantDraft>) {
    setVariants((current) => ({
      ...current,
      [platform]: { ...(current[platform] ?? emptyVariant(null)), ...patch },
    }));
  }

  async function save(action: "draft" | "approval") {
    if (!title.trim()) {
      toast.error("Give the post a title");
      return;
    }
    if (selected.length === 0) {
      toast.error("Select at least one target platform");
      return;
    }
    const missing = selected.filter((p) => !(variants[p]?.body ?? "").trim());
    if (missing.length > 0) {
      toast.error(`Add copy for ${missing.map(platformLabel).join(", ")}`);
      return;
    }

    setBusy(action);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      let campaignId: string | null = null;
      if (campaignName.trim()) {
        const { data: campaign, error } = await supabase
          .from("campaigns")
          .insert({
            org_id: organization.id,
            name: campaignName.trim(),
            created_by: userId,
          })
          .select("id")
          .single();
        if (error) throw error;
        campaignId = campaign.id;
      }

      const scheduledAt =
        scheduleDate && scheduleTime ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString() : null;

      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert({
          org_id: organization.id,
          campaign_id: campaignId,
          title: title.trim(),
          status: action === "approval" ? "pending_approval" : "draft",
          scheduled_at: scheduledAt,
          created_by: userId,
        })
        .select("id")
        .single();
      if (postError) throw postError;

      const { error: variantError } = await supabase.from("post_variants").insert(
        selected.map((platform) => {
          const draft = variants[platform] ?? emptyVariant(null);
          return {
            org_id: organization.id,
            post_id: post.id,
            channel_id: draft.channelId,
            platform,
            body: draft.body.trim(),
            cta: draft.cta.trim() || null,
            media_reference: draft.media.trim() || null,
            hashtags: draft.hashtags
              .split(/[\s,]+/)
              .map((tag) => tag.trim())
              .filter(Boolean)
              .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)),
          };
        }),
      );
      if (variantError) throw variantError;

      if (action === "approval") {
        const { error: approvalError } = await supabase.from("approvals").insert({
          org_id: organization.id,
          post_id: post.id,
          decision: "pending",
          requested_by: userId,
        });
        if (approvalError) throw approvalError;
      }

      await logActivity({
        orgId: organization.id,
        action: action === "approval" ? "post.submitted_for_approval" : "post.draft_saved",
        entityType: "post",
        entityId: post.id,
        postId: post.id,
        detail: { platforms: selected, scheduled_at: scheduledAt },
      });

      invalidate();
      toast.success(action === "approval" ? "Sent for approval" : "Draft saved");
      navigate({ to: action === "approval" ? "/approvals" : "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the post");
    } finally {
      setBusy(null);
    }
  }

  if (!canEdit(role)) {
    return (
      <div>
        <PageHeader title="Content Composer" />
        <EmptyState
          title="Read-only access"
          description="Your role can view content but not create it. Ask an administrator for editor access."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Content Composer"
        description="One campaign, one post, platform-specific variants. Nothing publishes without approval."
        actions={
          <>
            <Button variant="outline" onClick={() => save("draft")} disabled={busy !== null}>
              {busy === "draft" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save draft
            </Button>
            <Button onClick={() => save("approval")} disabled={busy !== null}>
              {busy === "approval" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Submit for approval
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="panel space-y-5 p-5 xl:col-span-1">
          <div className="space-y-2">
            <Label htmlFor="campaign">Campaign name</Label>
            <Input
              id="campaign"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Q4 AI Business OS launch"
            />
            <p className="text-xs text-muted-foreground">Optional — groups related posts together.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Post title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcing the Social Command Centre"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Schedule date</Label>
              <Input id="date" type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input id="time" type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Target channels</Label>
            {channels.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <>
                {(channels.data ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    No channels connected yet. You can still draft per platform — variants will attach to a
                    channel once Buffer is connected.{" "}
                    <Link to="/channels" className="font-medium text-primary underline-offset-4 hover:underline">
                      Connect channels
                    </Link>
                  </div>
                ) : null}
                <div className="grid gap-2">
                  {PLATFORMS.map((platform) => {
                    const channel = channelsByPlatform.get(platform);
                    const active = selected.includes(platform);
                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => togglePlatform(platform)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/8 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <PlatformIcon platform={platform} />
                        <span className="flex-1 font-medium text-foreground">{platformLabel(platform)}</span>
                        <span className="text-xs text-muted-foreground">
                          {channel ? channel.label : "not connected"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="panel xl:col-span-2">
          {selected.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Plug className="size-6" />}
                title="Pick your platforms"
                description="Select target channels on the left to start writing platform-specific variants."
              />
            </div>
          ) : (
            <Tabs defaultValue={selected[0]} className="p-5">
              <TabsList className="flex-wrap">
                {selected.map((platform) => (
                  <TabsTrigger key={platform} value={platform} className="gap-2">
                    <PlatformIcon platform={platform} className="size-3.5" />
                    {platformLabel(platform)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {selected.map((platform) => {
                const draft = variants[platform] ?? emptyVariant(null);
                const limit = PLATFORM_LIMITS[platform] ?? 2000;
                const over = draft.body.length > limit;
                return (
                  <TabsContent key={platform} value={platform} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`body-${platform}`}>Post copy</Label>
                        <span className={cn("text-xs tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
                          {draft.body.length}/{limit}
                        </span>
                      </div>
                      <Textarea
                        id={`body-${platform}`}
                        rows={8}
                        value={draft.body}
                        onChange={(e) => updateVariant(platform, { body: e.target.value })}
                        placeholder={`Write the ${platformLabel(platform)} version…`}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`hashtags-${platform}`}>Hashtags</Label>
                        <Input
                          id={`hashtags-${platform}`}
                          value={draft.hashtags}
                          onChange={(e) => updateVariant(platform, { hashtags: e.target.value })}
                          placeholder="#AI #BusinessOS"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`cta-${platform}`}>Call to action</Label>
                        <Input
                          id={`cta-${platform}`}
                          value={draft.cta}
                          onChange={(e) => updateVariant(platform, { cta: e.target.value })}
                          placeholder="Book a demo → texcortech.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`media-${platform}`}>Media reference</Label>
                      <Input
                        id={`media-${platform}`}
                        value={draft.media}
                        onChange={(e) => updateVariant(platform, { media: e.target.value })}
                        placeholder="Asset name or URL for the design team"
                      />
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </section>
      </div>
    </div>
  );
}
