import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCard({
  label,
  value,
  hint,
  icon,
  loading,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("panel p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-eyebrow">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-16" />
      ) : (
        <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
      )}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
