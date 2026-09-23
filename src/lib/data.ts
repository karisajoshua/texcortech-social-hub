import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PostStatus } from "./constants";

export type Channel = {
  id: string;
  platform: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type Connection = {
  id: string;
  provider: string;
  status: string;
  external_account_email: string | null;
  last_synced_at: string | null;
  last_error: string | null;
};

export type Variant = {
  id: string;
  platform: string;
  body: string;
  hashtags: string[];
  cta: string | null;
  media_reference: string | null;
  channel_id: string | null;
};

export type Post = {
  id: string;
  title: string;
  status: PostStatus;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  campaign_id: string | null;
  campaigns: { name: string } | null;
  post_variants: Variant[];
};

export function useChannels(orgId: string) {
  return useQuery({
    queryKey: ["channels", orgId],
    queryFn: async (): Promise<Channel[]> => {
      const { data, error } = await supabase
        .from("social_channels")
        .select("id, platform, handle, display_name, avatar_url, is_active, created_at")
        .eq("org_id", orgId)
        .order("platform");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useConnection(orgId: string) {
  return useQuery({
    queryKey: ["connection", orgId],
    queryFn: async (): Promise<Connection | null> => {
      const { data, error } = await supabase
        .from("social_connections")
        .select("id, provider, status, external_account_email, last_synced_at, last_error")
        .eq("org_id", orgId)
        .eq("provider", "buffer")
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function usePosts(orgId: string, statuses?: PostStatus[]) {
  return useQuery({
    queryKey: ["posts", orgId, statuses?.join(",") ?? "all"],
    queryFn: async (): Promise<Post[]> => {
      let query = supabase
        .from("posts")
        .select(
          "id, title, status, scheduled_at, created_at, updated_at, campaign_id, campaigns(name), post_variants(id, platform, body, hashtags, cta, media_reference, channel_id)",
        )
        .eq("org_id", orgId)
        .order("updated_at", { ascending: false });
      if (statuses && statuses.length > 0) query = query.in("status", statuses);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Post[];
    },
  });
}

export function useCampaigns(orgId: string) {
  return useQuery({
    queryKey: ["campaigns", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, description, objective, status, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useActivity(orgId: string, limit = 50) {
  return useQuery({
    queryKey: ["activity", orgId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, action, actor_email, result, detail, created_at, post_id, channel_id, entity_type")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMembers(orgId: string) {
  return useQuery({
    queryKey: ["members", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("id, role, user_id, created_at")
        .eq("org_id", orgId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useApprovals(orgId: string) {
  return useQuery({
    queryKey: ["approvals", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approvals")
        .select("id, post_id, decision, note, created_at, decided_at, requested_by, decided_by")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function logActivity(input: {
  orgId: string;
  action: string;
  result?: string;
  entityType?: string;
  entityId?: string | null;
  postId?: string | null;
  channelId?: string | null;
  detail?: Record<string, unknown>;
}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("activity_logs").insert({
    org_id: input.orgId,
    actor_id: auth.user.id,
    actor_email: auth.user.email ?? null,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    post_id: input.postId ?? null,
    channel_id: input.channelId ?? null,
    result: input.result ?? "success",
    detail: (input.detail ?? {}) as never,
  });
}

export function useInvalidateWorkspaceData() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ["posts", "approvals", "activity", "channels", "connection", "campaigns"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

/** Draft -> Pending approval -> Approved -> Scheduled. */
export function usePostWorkflow(orgId: string) {
  const invalidate = useInvalidateWorkspaceData();

  const submitForApproval = useMutation({
    mutationFn: async (postId: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("posts")
        .update({ status: "pending_approval" })
        .eq("id", postId)
        .eq("org_id", orgId);
      if (error) throw error;
      const { error: approvalError } = await supabase.from("approvals").insert({
        org_id: orgId,
        post_id: postId,
        decision: "pending",
        requested_by: auth.user?.id ?? null,
      });
      if (approvalError) throw approvalError;
      await logActivity({ orgId, action: "post.submitted_for_approval", postId, entityType: "post", entityId: postId });
    },
    onSuccess: invalidate,
  });

  const decide = useMutation({
    mutationFn: async (input: { postId: string; approve: boolean; note?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: approval } = await supabase
        .from("approvals")
        .select("id")
        .eq("post_id", input.postId)
        .eq("decision", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (approval) {
        const { error } = await supabase
          .from("approvals")
          .update({
            decision: input.approve ? "approved" : "rejected",
            note: input.note ?? null,
            decided_by: auth.user?.id ?? null,
            decided_at: new Date().toISOString(),
          })
          .eq("id", approval.id);
        if (error) throw error;
      }

      const { error: postError } = await supabase
        .from("posts")
        .update({ status: input.approve ? "approved" : "draft" })
        .eq("id", input.postId)
        .eq("org_id", orgId);
      if (postError) throw postError;

      await logActivity({
        orgId,
        action: input.approve ? "post.approved" : "post.rejected",
        postId: input.postId,
        entityType: "post",
        entityId: input.postId,
        detail: input.note ? { note: input.note } : {},
      });
    },
    onSuccess: invalidate,
  });

  const schedule = useMutation({
    mutationFn: async (input: { postId: string; scheduledAt: string }) => {
      const { data: variants } = await supabase
        .from("post_variants")
        .select("id, channel_id")
        .eq("post_id", input.postId);

      const { error } = await supabase
        .from("posts")
        .update({ status: "scheduled", scheduled_at: input.scheduledAt })
        .eq("id", input.postId)
        .eq("org_id", orgId);
      if (error) throw error;

      await supabase.from("schedules").delete().eq("post_id", input.postId);
      if (variants && variants.length > 0) {
        const { error: scheduleError } = await supabase.from("schedules").insert(
          variants.map((variant) => ({
            org_id: orgId,
            post_id: input.postId,
            variant_id: variant.id,
            channel_id: variant.channel_id,
            scheduled_at: input.scheduledAt,
            status: "pending",
          })),
        );
        if (scheduleError) throw scheduleError;
      }

      await logActivity({
        orgId,
        action: "post.scheduled",
        postId: input.postId,
        entityType: "post",
        entityId: input.postId,
        detail: { scheduled_at: input.scheduledAt },
      });
    },
    onSuccess: invalidate,
  });

  return { submitForApproval, decide, schedule };
}
