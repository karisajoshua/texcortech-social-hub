import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TENANT_SLUG } from "./constants";

/**
 * Makes sure the signed-in user has a profile and a membership in the
 * primary tenant (Texcortech Systems). Runs on every app load.
 */
export const bootstrapWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const email = (context.claims as { email?: string } | null)?.email ?? null;

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, name, slug, timezone")
      .eq("slug", TENANT_SLUG)
      .maybeSingle();
    if (orgError) throw new Error(orgError.message);
    if (!org) throw new Error("Primary organization is missing");

    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: (context.claims as { user_metadata?: { full_name?: string } } | null)
          ?.user_metadata?.full_name ?? null,
      },
      { onConflict: "id" },
    );

    const { data: existing } = await supabaseAdmin
      .from("memberships")
      .select("id, role")
      .eq("org_id", org.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      const { count } = await supabaseAdmin
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org.id);

      await supabaseAdmin.from("memberships").insert({
        org_id: org.id,
        user_id: userId,
        role: (count ?? 0) === 0 ? "owner" : "editor",
      });
    }

    // Ensure a Buffer connection row exists so the UI can show real status.
    const { data: connection } = await supabaseAdmin
      .from("social_connections")
      .select("id")
      .eq("org_id", org.id)
      .eq("provider", "buffer")
      .maybeSingle();
    if (!connection) {
      await supabaseAdmin.from("social_connections").insert({
        org_id: org.id,
        provider: "buffer",
        status: "not_configured",
        created_by: userId,
      });
    }

    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("role")
      .eq("org_id", org.id)
      .eq("user_id", userId)
      .maybeSingle();

    return {
      organization: org,
      role: membership?.role ?? "editor",
    };
  });
