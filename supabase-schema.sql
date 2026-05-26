-- Supabase setup for Marchao Sanma sharing, Auth-backed stats, and ranking foundations.
-- Use anon/publishable key on the frontend. Do not expose service_role keys.

create table if not exists public.shared_paifus (
  share_id text primary key,
  created_at timestamptz not null default now(),
  rules_version text not null default 'marchao-sanma-v1',
  app_version text,
  title text not null,
  paifu_json jsonb not null,
  settlement_json jsonb,
  is_public boolean not null default true
);

alter table public.shared_paifus
  add column if not exists rules_version text not null default 'marchao-sanma-v1';

alter table public.shared_paifus
  add column if not exists app_version text;

create index if not exists shared_paifus_public_created_at_idx
  on public.shared_paifus (is_public, created_at desc);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.hanchan_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hanchan_id text not null,
  ended_at timestamptz not null default now(),
  rank integer not null,
  final_raw_score integer not null,
  settlement_point integer not null,
  chip_count integer not null,
  total_hands integer not null,
  win_count integer not null,
  deal_in_count integer not null,
  riichi_count integer not null,
  called_hand_count integer not null,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  unique(user_id, hanchan_id)
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hanchan_stats'
      and column_name = 'id'
      and data_type <> 'uuid'
  ) then
    alter table public.hanchan_stats drop constraint if exists hanchan_stats_pkey;
    alter table public.hanchan_stats drop column if exists id;
    alter table public.hanchan_stats add column id uuid not null default gen_random_uuid();
    alter table public.hanchan_stats add primary key (id);
  end if;
end $$;

alter table public.hanchan_stats
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists ended_at timestamptz not null default now(),
  add column if not exists final_raw_score integer not null default 0,
  add column if not exists riichi_count integer not null default 0,
  add column if not exists called_hand_count integer not null default 0,
  add column if not exists duration_seconds integer;

update public.hanchan_stats
set ended_at = coalesce(ended_at, created_at, now());

delete from public.hanchan_stats
where user_id is null;

alter table public.hanchan_stats
  alter column user_id set not null,
  alter column ended_at set not null,
  alter column final_raw_score set not null,
  alter column riichi_count set not null,
  alter column called_hand_count set not null;

drop index if exists hanchan_stats_hanchan_id_idx;
create index if not exists hanchan_stats_user_ended_at_idx
  on public.hanchan_stats (user_id, ended_at desc);

create unique index if not exists hanchan_stats_user_hanchan_unique
  on public.hanchan_stats (user_id, hanchan_id);

drop function if exists public.get_hanchan_ranking_summary(integer);
drop view if exists public.hanchan_ranking_summary;

create view public.hanchan_ranking_summary as
select
  p.display_name,
  count(s.*)::integer as hanchan_count,
  coalesce(sum(s.settlement_point), 0)::integer as total_settlement_point,
  coalesce(round(avg(s.settlement_point))::integer, 0) as average_settlement_point,
  coalesce(round(avg(s.rank)::numeric, 2), 0) as average_rank,
  coalesce(round(avg(s.final_raw_score))::integer, 0) as average_final_raw_score,
  coalesce(sum(s.chip_count), 0)::integer as total_chip_count,
  coalesce(sum(s.total_hands), 0)::integer as total_hands,
  case when coalesce(sum(s.total_hands), 0) = 0 then 0
    else round(sum(s.final_raw_score - 35000)::numeric / sum(s.total_hands), 1)
  end as round_profit,
  round(avg(s.duration_seconds))::integer as average_duration_seconds,
  case when coalesce(sum(s.total_hands), 0) = 0 then 0
    else round(sum(s.win_count)::numeric / sum(s.total_hands) * 100, 1)
  end as win_rate,
  case when coalesce(sum(s.total_hands), 0) = 0 then 0
    else round(sum(s.deal_in_count)::numeric / sum(s.total_hands) * 100, 1)
  end as deal_in_rate,
  case when coalesce(sum(s.total_hands), 0) = 0 then 0
    else round(sum(s.riichi_count)::numeric / sum(s.total_hands) * 100, 1)
  end as riichi_rate,
  case when coalesce(sum(s.total_hands), 0) = 0 then 0
    else round(sum(s.called_hand_count)::numeric / sum(s.total_hands) * 100, 1)
  end as called_rate
from public.profiles p
join public.hanchan_stats s on s.user_id = p.user_id
group by p.user_id, p.display_name;

create function public.get_hanchan_ranking_summary(limit_count integer default 50)
returns table (
  display_name text,
  hanchan_count integer,
  total_settlement_point integer,
  average_settlement_point integer,
  average_rank numeric,
  average_final_raw_score integer,
  total_chip_count integer,
  total_hands integer,
  round_profit numeric,
  average_duration_seconds integer,
  win_rate numeric,
  deal_in_rate numeric,
  riichi_rate numeric,
  called_rate numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    summary.display_name,
    summary.hanchan_count,
    summary.total_settlement_point,
    summary.average_settlement_point,
    summary.average_rank,
    summary.average_final_raw_score,
    summary.total_chip_count,
    summary.total_hands,
    summary.round_profit,
    summary.average_duration_seconds,
    summary.win_rate,
    summary.deal_in_rate,
    summary.riichi_rate,
    summary.called_rate
  from public.hanchan_ranking_summary summary
  order by summary.total_settlement_point desc, summary.average_rank asc, summary.hanchan_count desc
  limit greatest(1, least(coalesce(limit_count, 500), 500));
$$;

grant select on public.hanchan_ranking_summary to authenticated;
grant execute on function public.get_hanchan_ranking_summary(integer) to authenticated;

alter table public.shared_paifus enable row level security;
alter table public.profiles enable row level security;
alter table public.hanchan_stats enable row level security;

drop policy if exists "Public can read public shared paifus" on public.shared_paifus;
drop policy if exists "Public can insert shared paifus for test" on public.shared_paifus;
drop policy if exists "Public can insert hanchan stats for test" on public.hanchan_stats;
drop policy if exists "Users can insert own stats" on public.hanchan_stats;
drop policy if exists "Users can read own stats" on public.hanchan_stats;
drop policy if exists "Users can insert own hanchan stats" on public.hanchan_stats;
drop policy if exists "Users can read own hanchan stats" on public.hanchan_stats;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can read profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Public can read public shared paifus"
  on public.shared_paifus
  for select
  using (is_public = true);

create policy "Public can insert shared paifus for test"
  on public.shared_paifus
  for insert
  with check (is_public = true);

create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can insert own hanchan stats"
  on public.hanchan_stats
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read own hanchan stats"
  on public.hanchan_stats
  for select
  to authenticated
  using (auth.uid() = user_id);
