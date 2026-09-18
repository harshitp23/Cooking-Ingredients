-- ============================================================================
-- Kitchen Inventory app — Shopping cart
--
-- Deliberately unlinked from kitchen_items and kitchen_recipe_items: this is
-- a plain, manually-managed grocery list. Nothing else in the app writes to
-- it, and it never writes to inventory or recipes.
--
-- Categories are their own rows (not a free-text column, unlike
-- kitchen_items.category / kitchen_recipes.category) so an empty category
-- can exist before it holds any items — the app's "+ Add category" flow
-- relies on that.
--
-- Paste into the Supabase SQL editor and run once, after the earlier
-- migrations. Safe to re-run. The app itself tolerates this migration not
-- having been run yet (the Shopping tab just stays empty/local-only until
-- it has), but items added before running it won't sync to other devices.
-- ============================================================================

create table if not exists public.kitchen_shopping_categories (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid()
                          references auth.users (id) on delete cascade,
  name        text        not null check (length(trim(name)) > 0),
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),

  constraint kitchen_shopping_categories_id_user_key unique (id, user_id)
);

create index if not exists kitchen_shopping_categories_user_idx
  on public.kitchen_shopping_categories (user_id, sort_order);

create table if not exists public.kitchen_shopping_items (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null default auth.uid()
                           references auth.users (id) on delete cascade,
  category_id  uuid        not null,
  name         text        not null check (length(trim(name)) > 0),
  qty          text,
  checked      boolean     not null default false,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now(),

  constraint kitchen_shopping_items_category_fk
    foreign key (category_id, user_id)
    references public.kitchen_shopping_categories (id, user_id) on delete cascade
);

create index if not exists kitchen_shopping_items_category_idx
  on public.kitchen_shopping_items (category_id, sort_order);

create index if not exists kitchen_shopping_items_user_idx
  on public.kitchen_shopping_items (user_id);

alter table public.kitchen_shopping_categories enable row level security;
alter table public.kitchen_shopping_items      enable row level security;

drop policy if exists kitchen_shopping_categories_select on public.kitchen_shopping_categories;
create policy kitchen_shopping_categories_select on public.kitchen_shopping_categories
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists kitchen_shopping_categories_insert on public.kitchen_shopping_categories;
create policy kitchen_shopping_categories_insert on public.kitchen_shopping_categories
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists kitchen_shopping_categories_update on public.kitchen_shopping_categories;
create policy kitchen_shopping_categories_update on public.kitchen_shopping_categories
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists kitchen_shopping_categories_delete on public.kitchen_shopping_categories;
create policy kitchen_shopping_categories_delete on public.kitchen_shopping_categories
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists kitchen_shopping_items_select on public.kitchen_shopping_items;
create policy kitchen_shopping_items_select on public.kitchen_shopping_items
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists kitchen_shopping_items_insert on public.kitchen_shopping_items;
create policy kitchen_shopping_items_insert on public.kitchen_shopping_items
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists kitchen_shopping_items_update on public.kitchen_shopping_items;
create policy kitchen_shopping_items_update on public.kitchen_shopping_items
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists kitchen_shopping_items_delete on public.kitchen_shopping_items;
create policy kitchen_shopping_items_delete on public.kitchen_shopping_items
  for delete to authenticated using (auth.uid() = user_id);
