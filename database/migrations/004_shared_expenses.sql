-- 004 — Shared expenses (groups, splits, settlements)
-- A group has members; each expense can be split across members.
-- balances/settlements are computed from expense_splits (who paid vs who owes).

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,  -- null = invited by email, not joined yet
  email text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  unique (group_id, email)
);

create table if not exists public.group_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  paid_by uuid references auth.users (id) on delete set null, -- who paid
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  group_expense_id uuid not null references public.group_expenses (id) on delete cascade,
  member_email text not null,
  share numeric(12, 2) not null check (share >= 0)
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_email text not null,   -- who paid back
  to_email text not null,     -- who got paid
  amount numeric(12, 2) not null check (amount > 0),
  settled_at timestamptz not null default now()
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;

create policy "Group members can view their groups"
  on public.groups for select
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.group_members m
      where m.group_id = groups.id
        and (m.user_id = auth.uid() or m.email = auth.jwt()->>'email')
    )
  );
create policy "Owners manage their groups"
  on public.groups for all using (auth.uid() = owner_id);

create policy "Members can view group membership"
  on public.group_members for select
  using (
    exists (
      select 1 from public.groups g
      join public.group_members me on me.group_id = g.id
      where g.id = group_id
        and (me.user_id = auth.uid() or me.email = auth.jwt()->>'email')
    )
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );
create policy "Group members insert membership"
  on public.group_members for insert
  with check (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );
create policy "Group members delete membership"
  on public.group_members for delete
  using (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
    or user_id = auth.uid()
    or email = auth.jwt()->>'email'
  );

create policy "Members can view group expenses"
  on public.group_expenses for select
  using (
    exists (
      select 1 from public.groups g
      join public.group_members me on me.group_id = g.id
      where g.id = group_id
        and (me.user_id = auth.uid() or me.email = auth.jwt()->>'email')
    )
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );
create policy "Members can add group expenses"
  on public.group_expenses for insert
  with check (
    exists (
      select 1 from public.group_members m
      where m.group_id = group_id and m.user_id = auth.uid()
    )
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );
create policy "Members can delete their group expenses"
  on public.group_expenses for delete
  using (
    paid_by = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

create policy "Splits follow their expense"
  on public.expense_splits for all
  using (
    exists (
      select 1 from public.group_expenses ge
      join public.group_members m on m.group_id = ge.group_id
      where ge.id = group_expense_id
        and (m.user_id = auth.uid() or m.email = auth.jwt()->>'email')
    )
    or exists (
      select 1 from public.group_expenses ge
      join public.groups g on g.id = ge.group_id
      where ge.id = group_expense_id and g.owner_id = auth.uid()
    )
  );

create policy "Members can view settlements"
  on public.settlements for select
  using (
    exists (
      select 1 from public.group_members m
      where m.group_id = group_id
        and (m.user_id = auth.uid() or m.email = auth.jwt()->>'email')
    )
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );
create policy "Members can record settlements"
  on public.settlements for insert
  with check (
    exists (
      select 1 from public.group_members m
      where m.group_id = group_id and m.user_id = auth.uid()
    )
  );
