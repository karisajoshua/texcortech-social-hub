import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ orgId: z.string().uuid() });

type Role = "owner" | "admin" | "approver" | "editor" | "viewer";

async function requireMembership(
  supabase: { from: (t: string) => any },
  orgId: string,
  userId: string,
  allowed: Role[],
) {
  const { data, error } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You are not a member of this workspace");
  if (!allowed.includes(data.role as Role)) throw new Error("You do not have permission for this action");
  return data.role as Role;
}

/** Checks whether BUFFER_ACCESS_TOKEN is present and valid, without leaking it. */
export const testBufferConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, data.orgId, context.userId, [
      "owner",
      "admin",
      "approver",
      "editor",
      "viewer",
    ]);

    const { getBufferToken, fetchBufferUser } = await import("./buffer.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = getBufferToken();

    if (!token) {
      await supabaseAdmin
        .from("social_connections")
        .update({ status: "not_configured", last_error: null })
        .eq("org_id", data.orgId)
        .eq("provider", "buffer");
      return { status: "not_configured" as const, message: "Buffer not configured" };
    }

    try {
      const user = await fetchBufferUser(token);
      await supabaseAdmin
        .from("social_connections")
        .update({
          status: "connected",
          external_account_id: user.id ?? null,
          external_account_email: user.email ?? null,
          last_error: null,
          last_synced_at: new Date().toISOString(),
        })
        .eq("org_id", data.orgId)
        .eq("provider", "buffer");
      return { status: "connected" as const, message: "Buffer connection verified" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Buffer error";
      await supabaseAdmin
        .from("social_connections")
        .update({ status: "error", last_error: message })
        .eq("org_id", data.orgId)
        .eq("provider", "buffer");
      return { status: "error" as const, message };
    }
  });

/** Pulls the real channels available on the connected Buffer account. */
export const syncBufferChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, data.orgId, context.userId, ["owner", "admin"]);

    const { getBufferToken, fetchBufferProfiles, normalisePlatform } = await import("./buffer.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = getBufferToken();

    if (!token) {
      return { status: "not_configured" as const, imported: 0, message: "Buffer not configured" };
    }

    const { data: connection } = await supabaseAdmin
      .from("social_connections")
      .select("id")
      .eq("org_id", data.orgId)
      .eq("provider", "buffer")
      .maybeSingle();

    try {
      const profiles = await fetchBufferProfiles(token);
      const rows = profiles.map((profile) => ({
        org_id: data.orgId,
        connection_id: connection?.id ?? null,
        platform: normalisePlatform(profile.service),
        external_id: profile.id,
        handle: profile.service_username ?? profile.formatted_username ?? null,
        display_name: profile.formatted_username ?? profile.service_username ?? null,
        avatar_url: profile.avatar_https ?? null,
        timezone: profile.timezone ?? null,
        is_active: !profile.disabled,
      }));

      if (rows.length > 0) {
        const { error } = await supabaseAdmin
          .from("social_channels")
          .upsert(rows, { onConflict: "org_id,platform,external_id" });
        if (error) throw new Error(error.message);
      }

      await supabaseAdmin
        .from("social_connections")
        .update({ status: "connected", last_synced_at: new Date().toISOString(), last_error: null })
        .eq("org_id", data.orgId)
        .eq("provider", "buffer");

      await supabaseAdmin.from("activity_logs").insert({
        org_id: data.orgId,
        actor_id: context.userId,
        actor_email: (context.claims as { email?: string } | null)?.email ?? null,
        action: "channels.sync",
        entity_type: "social_connection",
        entity_id: connection?.id ?? null,
        result: "success",
        detail: { imported: rows.length },
      });

      return { status: "connected" as const, imported: rows.length, message: `${rows.length} channel(s) synced` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Buffer error";
      await supabaseAdmin
        .from("social_connections")
        .update({ status: "error", last_error: message })
        .eq("org_id", data.orgId)
        .eq("provider", "buffer");
      await supabaseAdmin.from("activity_logs").insert({
        org_id: data.orgId,
        actor_id: context.userId,
        actor_email: (context.claims as { email?: string } | null)?.email ?? null,
        action: "channels.sync",
        entity_type: "social_connection",
        result: "failed",
        detail: { error: message },
      });
      return { status: "error" as const, imported: 0, message };
    }
  });

/**
 * Publishes an approved post to Buffer. Refuses anything that has not been
 * explicitly approved, and records a publishing job + audit entry per channel.
 */
export const publishPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ orgId: z.string().uuid(), postId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, data.orgId, context.userId, ["owner", "admin", "approver"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getBufferToken, createBufferUpdate } = await import("./buffer.server");
    const actorEmail = (context.claims as { email?: string } | null)?.email ?? null;

    const { data: post, error: postError } = await supabaseAdmin
      .from("posts")
      .select("id, org_id, title, status, scheduled_at")
      .eq("id", data.postId)
      .eq("org_id", data.orgId)
      .maybeSingle();
    if (postError) throw new Error(postError.message);
    if (!post) throw new Error("Post not found");

    if (post.status !== "approved" && post.status !== "scheduled") {
      throw new Error("Only approved posts can be published externally");
    }

    const token = getBufferToken();
    if (!token) {
      return { status: "not_configured" as const, message: "Buffer not configured", published: 0 };
    }

    const { data: variants } = await supabaseAdmin
      .from("post_variants")
      .select("id, platform, body, hashtags, cta, media_reference, channel_id")
      .eq("post_id", post.id);

    if (!variants || variants.length === 0) throw new Error("This post has no channel variants");

    const channelIds = variants.map((v) => v.channel_id).filter(Boolean) as string[];
    const { data: channels } = await supabaseAdmin
      .from("social_channels")
      .select("id, external_id, platform, display_name")
      .in("id", channelIds.length > 0 ? channelIds : ["00000000-0000-0000-0000-000000000000"]);

    const channelById = new Map((channels ?? []).map((c) => [c.id, c]));
    let published = 0;
    const failures: string[] = [];

    for (const variant of variants) {
      const channel = variant.channel_id ? channelById.get(variant.channel_id) : undefined;
      const { data: job } = await supabaseAdmin
        .from("publishing_jobs")
        .insert({
          org_id: data.orgId,
          post_id: post.id,
          variant_id: variant.id,
          channel_id: variant.channel_id,
          status: "running",
          attempts: 1,
        })
        .select("id")
        .single();

      if (!channel) {
        const message = `No connected ${variant.platform} channel for this variant`;
        failures.push(message);
        if (job) {
          await supabaseAdmin
            .from("publishing_jobs")
            .update({ status: "failed", last_error: message })
            .eq("id", job.id);
        }
        await supabaseAdmin.from("activity_logs").insert({
          org_id: data.orgId,
          actor_id: context.userId,
          actor_email: actorEmail,
          action: "post.publish",
          entity_type: "post_variant",
          entity_id: variant.id,
          post_id: post.id,
          result: "failed",
          detail: { error: message, platform: variant.platform },
        });
        continue;
      }

      const hashtags = (variant.hashtags ?? []) as string[];
      const text = [variant.body, variant.cta, hashtags.join(" ")].filter(Boolean).join("\n\n");

      try {
        const result = await createBufferUpdate(token, {
          profileIds: [channel.external_id],
          text,
          scheduledAt: post.scheduled_at,
          mediaUrl: null,
        });
        const externalId = result.updates?.[0]?.id ?? null;
        published += 1;
        if (job) {
          await supabaseAdmin
            .from("publishing_jobs")
            .update({ status: "succeeded", external_post_id: externalId })
            .eq("id", job.id);
        }
        await supabaseAdmin.from("activity_logs").insert({
          org_id: data.orgId,
          actor_id: context.userId,
          actor_email: actorEmail,
          action: "post.publish",
          entity_type: "post_variant",
          entity_id: variant.id,
          channel_id: channel.id,
          post_id: post.id,
          result: "success",
          detail: { platform: variant.platform, external_post_id: externalId },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Buffer error";
        failures.push(`${variant.platform}: ${message}`);
        if (job) {
          await supabaseAdmin
            .from("publishing_jobs")
            .update({ status: "failed", last_error: message })
            .eq("id", job.id);
        }
        await supabaseAdmin.from("activity_logs").insert({
          org_id: data.orgId,
          actor_id: context.userId,
          actor_email: actorEmail,
          action: "post.publish",
          entity_type: "post_variant",
          entity_id: variant.id,
          channel_id: channel.id,
          post_id: post.id,
          result: "failed",
          detail: { platform: variant.platform, error: message },
        });
      }
    }

    const finalStatus = published > 0 && failures.length === 0 ? "published" : failures.length > 0 && published === 0 ? "failed" : "published";
    await supabaseAdmin.from("posts").update({ status: finalStatus }).eq("id", post.id);
    await supabaseAdmin
      .from("schedules")
      .update({ status: published > 0 ? "sent" : "failed" })
      .eq("post_id", post.id);

    return {
      status: failures.length === 0 ? ("published" as const) : ("partial" as const),
      published,
      message:
        failures.length === 0
          ? `Sent ${published} update(s) to Buffer`
          : `Published ${published}, failed ${failures.length}: ${failures.join("; ")}`,
    };
  });
