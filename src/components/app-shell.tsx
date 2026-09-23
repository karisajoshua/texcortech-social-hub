import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  LayoutDashboard,
  LogOut,
  Menu,
  PenSquare,
  Plug,
  Settings,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConnectionBadge } from "@/components/status-badge";
import { useConnection } from "@/lib/data";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/composer", label: "Content Composer", icon: PenSquare },
  { to: "/approvals", label: "Approval Queue", icon: CheckCircle2 },
  { to: "/calendar", label: "Schedule", icon: CalendarDays },
  { to: "/channels", label: "Channels", icon: Plug },
  { to: "/activity", label: "Activity Log", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { organization, role } = useWorkspace();
  const { data: connection } = useConnection(organization.id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 px-5 py-5">
      <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
        TX
      </span>
      <div className="leading-tight">
        <p className="font-display text-sm font-semibold text-sidebar-accent-foreground">
          Social Command Centre
        </p>
        <p className="text-xs text-sidebar-foreground/60">Texcortech AI Business OS</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        {brand}
        {nav}
        <div className="border-t border-sidebar-border p-4">
          <p className="text-xs text-sidebar-foreground/60">{organization.name}</p>
          <p className="text-xs font-medium capitalize text-sidebar-accent-foreground">{role}</p>
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-full w-72 flex-col bg-sidebar">
            <div className="flex items-center justify-between">
              {brand}
              <Button variant="ghost" size="icon" className="mr-3 text-sidebar-foreground" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            {nav}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-eyebrow">Workspace</p>
            <p className="truncate font-display text-sm font-semibold">{organization.name}</p>
          </div>
          <ConnectionBadge status={connection?.status ?? "not_configured"} />
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
