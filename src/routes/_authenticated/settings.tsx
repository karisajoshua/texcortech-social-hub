import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useMembers } from "@/lib/data";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings | Social Command Centre" },
      {
        name: "description",
        content: "Workspace profile, team roles, timezone and AI assistance readiness.",
      },
      { property: "og:title", content: "Settings | Social Command Centre" },
      { property: "og:description", content: "Workspace and team settings for Texcortech Systems." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { organization, role } = useWorkspace();
  const members = useMembers(organization.id);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!active) return;
      setFullName(profile?.full_name ?? "");
      setEmail(profile?.email ?? auth.user.email ?? "");
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", auth.user.id);
      if (error) throw error;
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Settings" description="Workspace, personal profile and module readiness." />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Your profile</h2>
          {loading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input id="profile-email" value={email} disabled />
              </div>
              <Button onClick={saveProfile} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          )}
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Workspace</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Organisation</dt>
              <dd className="font-medium">{organization.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Identifier</dt>
              <dd className="font-mono text-xs">{organization.slug}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Timezone</dt>
              <dd className="font-medium">{organization.timezone}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Your role</dt>
              <dd className="font-medium capitalize">{role}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            This module is multi-tenant. Texcortech Systems is the first organisation; additional tenants
            can be added without schema changes.
          </p>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Team</h2>
          {members.isPending ? (
            <Skeleton className="mt-4 h-24 w-full" />
          ) : (
            <ul className="mt-4 divide-y divide-border text-sm">
              {(members.data ?? []).map((member) => (
                <li key={member.id} className="flex items-center justify-between py-2.5">
                  <span className="font-mono text-xs text-muted-foreground">
                    {member.user_id.slice(0, 8)}…
                  </span>
                  <span className="font-medium capitalize">{member.role}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Roles: owner and admin manage integrations, approvers sign off content, editors draft,
            viewers read only.
          </p>
        </section>

        <section className="panel p-5">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Sparkles className="size-4 text-accent" /> AI content assistance
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The composer is structured for AI-assisted variant generation per platform. No AI key is
            required today — the groundwork (campaign, variants, tone per channel) is already stored so
            generation can be switched on later without migrating data.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Status: prepared, not enabled.</p>
        </section>
      </div>
    </div>
  );
}
