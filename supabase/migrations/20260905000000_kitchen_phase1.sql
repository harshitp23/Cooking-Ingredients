-- ============================================================================
-- Kitchen Inventory app — Phase 1 schema
-- Paste this whole file into the Supabase SQL editor and run it once.
--
-- Auth model (see notes at bottom): standard Supabase Auth.
--   user_id defaults to auth.uid() and every RLS policy is auth.uid() = user_id.
--
-- Phase 2 (recipes / "what can I make") only ADDS columns and rows to the
-- recipe tables below — it never alters an existing column here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- shared: updated_at trigger fn (namespaced so it can't collide with other apps)
-- ----------------------------------------------------------------------------
create or replace function public.kitchen_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
-- kitchen_items
-- ============================================================================
create table if not exists public.kitchen_items (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid()
                          references auth.users (id) on delete cascade,
  name        text        not null check (length(trim(name)) > 0),
  kind        text        not null check (kind in ('ingredient', 'equipment')),
  state       text        not null default 'have'
                          check (state in ('have', 'low', 'out')),
  category    text,
  is_staple   boolean     not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- lets the recipe join table point a composite FK at (id, user_id) so a
  -- user can never attach another user's item to their recipe.
  constraint kitchen_items_id_user_key unique (id, user_id)
);

-- Inventory View A: filter by user + kind, group by category.
create index if not exists kitchen_items_user_kind_category_idx
  on public.kitchen_items (user_id, kind, category);

-- Shopping View B: ingredients that are low/out and not staples.
create index if not exists kitchen_items_shopping_idx
  on public.kitchen_items (user_id)
  where kind = 'ingredient' and is_staple = false and state <> 'have';

drop trigger if exists kitchen_items_set_updated_at on public.kitchen_items;
create trigger kitchen_items_set_updated_at
  before update on public.kitchen_items
  for each row execute function public.kitchen_set_updated_at();

-- ============================================================================
-- kitchen_recipes  (empty in Phase 1 — shape locked now)
-- ============================================================================
create table if not exists public.kitchen_recipes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid()
                          references auth.users (id) on delete cascade,
  name        text        not null check (length(trim(name)) > 0),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint kitchen_recipes_id_user_key unique (id, user_id)
);

create index if not exists kitchen_recipes_user_idx
  on public.kitchen_recipes (user_id);

drop trigger if exists kitchen_recipes_set_updated_at on public.kitchen_recipes;
create trigger kitchen_recipes_set_updated_at
  before update on public.kitchen_recipes
  for each row execute function public.kitchen_set_updated_at();

-- ============================================================================
-- kitchen_recipe_items  (empty in Phase 1 — FK shape locked now)
-- ============================================================================
create table if not exists public.kitchen_recipe_items (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null default auth.uid()
                           references auth.users (id) on delete cascade,
  recipe_id    uuid        not null,
  item_id      uuid        not null,
  display_qty  text,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now(),

  -- deleting a recipe removes its lines...
  constraint kitchen_recipe_items_recipe_fk
    foreign key (recipe_id, user_id)
    references public.kitchen_recipes (id, user_id) on delete cascade,

  -- ...but an item that's still referenced by a recipe can't be deleted.
  constraint kitchen_recipe_items_item_fk
    foreign key (item_id, user_id)
    references public.kitchen_items (id, user_id) on delete restrict,

  constraint kitchen_recipe_items_unique_line unique (recipe_id, item_id)
);

-- load a recipe's lines in order
create index if not exists kitchen_recipe_items_recipe_idx
  on public.kitchen_recipe_items (recipe_id, sort_order);

-- Phase 2 reverse lookup ("which recipes use this item") + backs the
-- ON DELETE RESTRICT check above.
create index if not exists kitchen_recipe_items_item_idx
  on public.kitchen_recipe_items (item_id);

create index if not exists kitchen_recipe_items_user_idx
  on public.kitchen_recipe_items (user_id);

-- ============================================================================
-- Row Level Security — enabled on all three tables, user_id-scoped.
-- ============================================================================
alter table public.kitchen_items        enable row level security;
alter table public.kitchen_recipes      enable row level security;
alter table public.kitchen_recipe_items enable row level security;

-- kitchen_items
drop policy if exists kitchen_items_select on public.kitchen_items;
create policy kitchen_items_select on public.kitchen_items
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists kitchen_items_insert on public.kitchen_items;
create policy kitchen_items_insert on public.kitchen_items
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists kitchen_items_update on public.kitchen_items;
create policy kitchen_items_update on public.kitchen_items
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists kitchen_items_delete on public.kitchen_items;
create policy kitchen_items_delete on public.kitchen_items
  for delete to authenticated using (auth.uid() = user_id);

-- kitchen_recipes
drop policy if exists kitchen_recipes_select on public.kitchen_recipes;
create policy kitchen_recipes_select on public.kitchen_recipes
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists kitchen_recipes_insert on public.kitchen_recipes;
create policy kitchen_recipes_insert on public.kitchen_recipes
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists kitchen_recipes_update on public.kitchen_recipes;
create policy kitchen_recipes_update on public.kitchen_recipes
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists kitchen_recipes_delete on public.kitchen_recipes;
create policy kitchen_recipes_delete on public.kitchen_recipes
  for delete to authenticated using (auth.uid() = user_id);

-- kitchen_recipe_items  (join table is scoped too — not optional on a public repo)
drop policy if exists kitchen_recipe_items_select on public.kitchen_recipe_items;
create policy kitchen_recipe_items_select on public.kitchen_recipe_items
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists kitchen_recipe_items_insert on public.kitchen_recipe_items;
create policy kitchen_recipe_items_insert on public.kitchen_recipe_items
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists kitchen_recipe_items_update on public.kitchen_recipe_items;
create policy kitchen_recipe_items_update on public.kitchen_recipe_items
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists kitchen_recipe_items_delete on public.kitchen_recipe_items;
create policy kitchen_recipe_items_delete on public.kitchen_recipe_items
  for delete to authenticated using (auth.uid() = user_id);

-- ============================================================================
-- NOTES
--
-- Auth: this assumes the same Supabase Auth setup your other apps use — a real
-- authenticated session, with RLS keyed on auth.uid(). The frontend will use
-- email magic-link / OTP sign-in (no password, works well as an iOS PWA).
-- If your other apps instead use a single hardcoded user_id + the anon key,
-- tell me and I'll swap the policies before you run this.
--
-- Phase-2 additions that will NOT require touching anything above:
--   alter table public.kitchen_recipes add column servings int;
--   alter table public.kitchen_recipes add column instructions text;
--   -- kitchen_recipe_items already has display_qty + sort_order.
-- ============================================================================
