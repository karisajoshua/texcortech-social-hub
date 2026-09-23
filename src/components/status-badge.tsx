import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  pending_approval: "bg-warning/15 text-warning-foreground border-warning/40",
  approved: "bg-info/15 text-info border-info/40",
  scheduled: "bg-accent/20 text-accent-foreground border-accent/50",
  published: "bg-success/15 text-success border-success/40",
  failed: "bg-destructive/12 text-destructive border-destructive/40",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function ConnectionBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    connected: { label: "Connected", className: "bg-success/15 text-success border-success/40" },
    not_configured: { label: "Buffer not configured", className: "bg-muted text-muted-foreground border-border" },
    error: { label: "Connection error", className: "bg-destructive/12 text-destructive border-destructive/40" },
  };
  const entry = map[status] ?? map["not_configured"]!;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        entry.className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {entry.label}
    </span>
  );
}
