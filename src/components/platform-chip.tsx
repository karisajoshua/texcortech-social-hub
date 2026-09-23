import { Facebook, Instagram, Linkedin, Music2, Twitter, Youtube, AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { platformLabel } from "@/lib/constants";

const ICONS: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  tiktok: Music2,
  threads: AtSign,
  youtube: Youtube,
};

export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const Icon = ICONS[platform] ?? AtSign;
  return <Icon className={cn("size-4", className)} aria-hidden />;
}

export function PlatformChip({ platform, className }: { platform: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground",
        className,
      )}
    >
      <PlatformIcon platform={platform} className="size-3.5" />
      {platformLabel(platform)}
    </span>
  );
}
