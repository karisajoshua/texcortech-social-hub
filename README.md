# Texcortech AI Social Command Centre

Secure social-media operations module for **Texcortech Systems**, built to plug into the wider
Texcortech AI Business OS. Multi-tenant from day one; Texcortech Systems is tenant #1.

## What it does

| Area | Detail |
| --- | --- |
| Overview | Connected channels, scheduled posts, drafts, approval queue, recent activity, performance placeholders |
| Content Composer | One campaign post with platform-specific variants (copy, media reference, hashtags, CTA, target channel, schedule) |
| Approval workflow | `draft → pending_approval → approved → scheduled → published / failed`. External publishing is refused unless the post is approved |
| Schedule | Month calendar plus a queue of upcoming publishes |
| Channels | Buffer connection status, connected profiles, supported platform matrix |
| Activity log | Actor, action, timestamp, channel, post, result, detail |
| Settings | Profile, workspace, team roles, AI readiness |

Supported platforms (subject to what exists on the connected Buffer account): LinkedIn, Facebook,
Instagram, X, TikTok, Threads, YouTube. **No social accounts are invented** — channels only appear
after a real sync from Buffer.

## Stack

- TypeScript, React 19, TanStack Start (SSR + server functions), Vite
- Tailwind CSS v4 with a semantic token design system (`src/styles.css`), shadcn/ui components
- Lovable Cloud backend (Postgres, Auth, secrets) with Row Level Security
- TanStack Query for data fetching

## Required secrets

| Secret | Where | Purpose |
| --- | --- | --- |
| `BUFFER_ACCESS_TOKEN` | Project Settings → Secrets (server-side only) | Buffer API access for connection test, channel sync and publishing |

The token is read only inside server functions (`process.env['BUFFER_ACCESS_TOKEN']`) and is never
sent to the browser. If it is absent, the UI shows **“Buffer not configured”** and drafting,
approvals and scheduling continue to work; only external publishing is paused.

Backend-provided secrets already in place: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (server-side), `VITE_SUPABASE_*` (browser, publishable only).

## Data model

`organizations`, `profiles`, `memberships`, `social_connections`, `social_channels`, `campaigns`,
`posts`, `post_variants`, `approvals`, `schedules`, `publishing_jobs`, `activity_logs`.

Roles: `owner`, `admin`, `approver`, `editor`, `viewer`.

## Security model

- Every table has RLS enabled; reads require membership of the row's organisation
  (`public.is_org_member`), writes require an appropriate role (`public.has_org_role`).
- `social_connections`, `social_channels` and `publishing_jobs` are read-only to the client; they are
  written exclusively by server functions using the service role.
- Buffer calls live in `src/lib/buffer.server.ts` (server-only) and are invoked by
  `src/lib/buffer.functions.ts` server functions:
  - `testBufferConnection` — verifies the token, records status, never returns the token
  - `syncBufferChannels` — imports real Buffer profiles as channels (owner/admin only)
  - `publishPost` — refuses any post that is not `approved` or `scheduled`; writes a
    `publishing_jobs` row and an `activity_logs` entry per channel
- No credentials in source code.

## First run

1. Sign up at `/auth` (email/password or Google). The first account becomes workspace **owner**;
   later accounts join as **editor**.
2. Add `BUFFER_ACCESS_TOKEN` in Project Settings → Secrets.
3. Go to **Channels** → *Test connection* → *Sync channels*.
4. Compose a post, submit for approval, approve, schedule, then publish.

## Roadmap hooks

- AI variant generation per platform (no key required today; campaign/variant structure is ready)
- Performance metrics pulled back from Buffer into the overview placeholders
- Automated dispatch of due schedules via a scheduled job hitting a server route
