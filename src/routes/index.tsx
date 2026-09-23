import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, LockKeyhole, ShieldCheck, Workflow } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Texcortech AI Social Command Centre" },
      {
        name: "description",
        content:
          "Secure, multi-tenant social media operations for Texcortech Systems: compose, approve, schedule and audit publishing across LinkedIn, Facebook, Instagram, X, TikTok, Threads and YouTube.",
      },
      { property: "og:title", content: "Texcortech AI Social Command Centre" },
      {
        property: "og:description",
        content:
          "Governed social publishing with approval workflow, audit trail and server-side Buffer integration.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-5 lg:px-12">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
            TX
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold">Texcortech Systems</p>
            <p className="text-xs text-muted-foreground">AI Social Command Centre</p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link to={signedIn ? "/dashboard" : "/auth"}>
            {signedIn ? "Open command centre" : "Sign in"}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </header>

      <section className="surface-grid border-y border-border">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center lg:py-28">
          <p className="text-eyebrow">Module of the Texcortech AI Business OS</p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Governed social publishing, one command centre
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground">
            Plan campaigns, craft platform-specific variants, route everything through explicit
            approval, then schedule and publish through your connected Buffer account — with a full
            audit trail behind every action.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to={signedIn ? "/dashboard" : "/auth"}>
                {signedIn ? "Open command centre" : "Sign in to continue"}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Workflow,
            title: "Approval workflow",
            body: "Draft, pending approval, approved, scheduled, published or failed — nothing leaves the building unapproved.",
          },
          {
            icon: CalendarClock,
            title: "Unified schedule",
            body: "One calendar across LinkedIn, Facebook, Instagram, X, TikTok, Threads and YouTube.",
          },
          {
            icon: LockKeyhole,
            title: "Credentials stay server-side",
            body: "Buffer access tokens live in secure backend secrets and never reach the browser.",
          },
          {
            icon: ShieldCheck,
            title: "Multi-tenant by design",
            body: "Organisation-scoped data and roles from day one. Texcortech Systems is tenant one.",
          },
        ].map((card) => (
          <div key={card.title} className="panel p-5">
            <card.icon className="size-5 text-primary" />
            <h3 className="mt-3 text-sm font-semibold">{card.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{card.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        Texcortech Systems — internal operations module. Access is restricted to invited team members.
      </footer>
    </div>
  );
}
