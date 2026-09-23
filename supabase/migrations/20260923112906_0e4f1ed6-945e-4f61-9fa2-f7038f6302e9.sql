
-- ENUMS
create type public.org_role as enum ('owner','admin','approver','editor','viewer');
create type public.post_status as enum ('draft','pending_approval','approved','scheduled','published','failed');
create type public.approval_decision as enum ('pending','approved','rejected');
create type public.job_status as enum ('queued','running','succeeded','failed','cancelled');

-- ORGANIZATIONS
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Africa/Johannesburg',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- MEMBERSHIPS
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.org_role not null default 'editor',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
grant select on public.memberships to authenticated;
grant all on public.memberships to service_role;
alter table public.memberships enable row level security;

-- HELPERS
create or replace function public.is_org_member(_org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.org_id = _org_id and m.user_id = auth.uid());
$$;

create or replace function public.has_org_role(_org_id uuid, _roles public.org_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = _org_id and m.user_id = auth.uid() and m.role = any(_roles)
  );
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create policy "members read their orgs" on public.organizations for select to authenticated using (public.is_org_member(id));
create policy "owners update their org" on public.organizations for update to authenticated using (public.has_org_role(id, array['owner','admin']::public.org_role[]));

create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "read profiles of org mates" on public.profiles for select to authenticated using (
  exists (select 1 from public.memberships a join public.memberships b on a.org_id = b.org_id
          where a.user_id = auth.uid() and b.user_id = public.profiles.id)
);
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid());

create policy "read memberships of my orgs" on public.memberships for select to authenticated using (public.is_org_member(org_id));

-- SOCIAL CONNECTIONS
create table public.social_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  provider text not null default 'buffer',
  status text not null default 'not_configured',
  external_account_id text,
  external_account_email text,
  last_synced_at timestamptz,
  last_error text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);
grant select on public.social_connections to authenticated;
grant all on public.social_connections to service_role;
alter table public.social_connections enable row level security;
create policy "members read connections" on public.social_connections for select to authenticated using (public.is_org_member(org_id));
create trigger t_social_connections_updated before update on public.social_connections for each row execute function public.set_updated_at();

-- SOCIAL CHANNELS
create table public.social_channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  connection_id uuid references public.social_connections on delete cascade,
  platform text not null,
  external_id text not null,
  handle text,
  display_name text,
  avatar_url text,
  timezone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, platform, external_id)
);
grant select on public.social_channels to authenticated;
grant all on public.social_channels to service_role;
alter table public.social_channels enable row level security;
create policy "members read channels" on public.social_channels for select to authenticated using (public.is_org_member(org_id));
create trigger t_social_channels_updated before update on public.social_channels for each row execute function public.set_updated_at();

-- CAMPAIGNS
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  name text not null,
  description text,
  objective text,
  status text not null default 'active',
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.campaigns to authenticated;
grant all on public.campaigns to service_role;
alter table public.campaigns enable row level security;
create policy "members read campaigns" on public.campaigns for select to authenticated using (public.is_org_member(org_id));
create policy "editors write campaigns" on public.campaigns for insert to authenticated with check (public.has_org_role(org_id, array['owner','admin','approver','editor']::public.org_role[]));
create policy "editors update campaigns" on public.campaigns for update to authenticated using (public.has_org_role(org_id, array['owner','admin','approver','editor']::public.org_role[]));
create policy "admins delete campaigns" on public.campaigns for delete to authenticated using (public.has_org_role(org_id, array['owner','admin']::public.org_role[]));
create trigger t_campaigns_updated before update on public.campaigns for each row execute function public.set_updated_at();

-- POSTS
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  campaign_id uuid references public.campaigns on delete set null,
  title text not null,
  status public.post_status not null default 'draft',
  scheduled_at timestamptz,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "members read posts" on public.posts for select to authenticated using (public.is_org_member(org_id));
create policy "editors insert posts" on public.posts for insert to authenticated with check (public.has_org_role(org_id, array['owner','admin','approver','editor']::public.org_role[]));
create policy "editors update posts" on public.posts for update to authenticated using (public.has_org_role(org_id, array['owner','admin','approver','editor']::public.org_role[]));
create policy "admins delete posts" on public.posts for delete to authenticated using (public.has_org_role(org_id, array['owner','admin']::public.org_role[]));
create trigger t_posts_updated before update on public.posts for each row execute function public.set_updated_at();

-- POST VARIANTS
create table public.post_variants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  post_id uuid not null references public.posts on delete cascade,
  channel_id uuid references public.social_channels on delete set null,
  platform text not null,
  body text not null default '',
  media_reference text,
  hashtags text[] not null default '{}',
  cta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.post_variants to authenticated;
grant all on public.post_variants to service_role;
alter table public.post_variants enable row level security;
create policy "members read variants" on public.post_variants for select to authenticated using (public.is_org_member(org_id));
create policy "editors insert variants" on public.post_variants for insert to authenticated with check (public.has_org_role(org_id, array['owner','admin','approver','editor']::public.org_role[]));
create policy "editors update variants" on public.post_variants for update to authenticated using (public.has_org_role(org_id, array['owner','admin','approver','editor']::public.org_role[]));
create policy "editors delete variants" on public.post_variants for delete to authenticated using (public.has_org_role(org_id, array['owner','admin','approver','editor']::public.org_role[]));
create trigger t_post_variants_updated before update on public.post_variants for each row execute function public.set_updated_at();

-- APPROVALS
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  post_id uuid not null references public.posts on delete cascade,
  decision public.approval_decision not null default 'pending',
  note text,
  requested_by uuid references auth.users on delete set null,
  decided_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
grant select, insert, update on public.approvals to authenticated;
grant all on public.approvals to service_role;
alter table public.approvals enable row level security;
create policy "members read approvals" on public.approvals for select to authenticated using (public.is_org_member(org_id));
create policy "editors request approval" on public.approvals for insert to authenticated with check (public.has_org_role(org_id, array['owner','admin','approver','editor']::public.org_role[]));
create policy "approvers decide" on public.approvals for update to authenticated using (public.has_org_role(org_id, array['owner','admin','approver']::public.org_role[]));

-- SCHEDULES
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  post_id uuid not null references public.posts on delete cascade,
  variant_id uuid references public.post_variants on delete cascade,
  channel_id uuid references public.social_channels on delete set null,
  scheduled_at timestamptz not null,
  timezone text not null default 'Africa/Johannesburg',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.schedules to authenticated;
grant all on public.schedules to service_role;
alter table public.schedules enable row level security;
create policy "members read schedules" on public.schedules for select to authenticated using (public.is_org_member(org_id));
create policy "editors insert schedules" on public.schedules for insert to authenticated with check (public.has_org_role(org_id, array['owner','admin','approver','editor']::public.org_role[]));
create policy "editors update schedules" on public.schedules for update to authenticated using (public.has_org_role(org_id, array['owner','admin','approver','editor']::public.org_role[]));
create policy "editors delete schedules" on public.schedules for delete to authenticated using (public.has_org_role(org_id, array['owner','admin','approver','editor']::public.org_role[]));
create trigger t_schedules_updated before update on public.schedules for each row execute function public.set_updated_at();

-- PUBLISHING JOBS
create table public.publishing_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  post_id uuid not null references public.posts on delete cascade,
  variant_id uuid references public.post_variants on delete set null,
  schedule_id uuid references public.schedules on delete set null,
  channel_id uuid references public.social_channels on delete set null,
  status public.job_status not null default 'queued',
  attempts integer not null default 0,
  external_post_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.publishing_jobs to authenticated;
grant all on public.publishing_jobs to service_role;
alter table public.publishing_jobs enable row level security;
create policy "members read jobs" on public.publishing_jobs for select to authenticated using (public.is_org_member(org_id));
create trigger t_publishing_jobs_updated before update on public.publishing_jobs for each row execute function public.set_updated_at();

-- ACTIVITY LOGS
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  actor_id uuid references auth.users on delete set null,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id uuid,
  channel_id uuid references public.social_channels on delete set null,
  post_id uuid references public.posts on delete set null,
  result text not null default 'success',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.activity_logs to authenticated;
grant all on public.activity_logs to service_role;
alter table public.activity_logs enable row level security;
create policy "members read activity" on public.activity_logs for select to authenticated using (public.is_org_member(org_id));
create policy "members write activity" on public.activity_logs for insert to authenticated with check (public.is_org_member(org_id) and actor_id = auth.uid());

create index idx_posts_org_status on public.posts(org_id, status);
create index idx_schedules_org_time on public.schedules(org_id, scheduled_at);
create index idx_activity_org_time on public.activity_logs(org_id, created_at desc);

-- TENANT #1
insert into public.organizations (name, slug, timezone)
values ('Texcortech Systems', 'texcortech-systems', 'Africa/Johannesburg');
