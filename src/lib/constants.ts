export const TENANT_SLUG = "texcortech-systems";

export const PLATFORMS = [
  "linkedin",
  "facebook",
  "instagram",
  "twitter",
  "tiktok",
  "threads",
  "youtube",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X (Twitter)",
  tiktok: "TikTok",
  threads: "Threads",
  youtube: "YouTube",
};

export const PLATFORM_LIMITS: Record<string, number> = {
  linkedin: 3000,
  facebook: 5000,
  instagram: 2200,
  twitter: 280,
  tiktok: 2200,
  threads: 500,
  youtube: 5000,
};

export function platformLabel(platform: string) {
  return PLATFORM_LABELS[platform] ?? platform;
}

export const POST_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
  "published",
  "failed",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
};
