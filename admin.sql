-- ESPACE ADMIN : à exécuter une fois dans Supabase > SQL Editor (après schema.sql).

-- Liste des administrateurs. Aucune politique d'écriture : seul le SQL Editor peut ajouter un admin,
-- personne ne peut se donner ce droit depuis le site.
create table if not exists public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.admins enable row level security;
drop policy if exists "Admin reads own row" on public.admins;
create policy "Admin reads own row" on public.admins for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from public.admins where user_id = (select auth.uid())) $$;

-- Produits : l'admin voit tout (même désactivés) et peut ajouter / modifier / supprimer.
drop policy if exists "Admin manages products" on public.products;
create policy "Admin manages products" on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Commandes : l'admin les voit toutes et change leur statut.
drop policy if exists "Admin reads orders" on public.orders;
drop policy if exists "Admin updates orders" on public.orders;
drop policy if exists "Admin reads order items" on public.order_items;
create policy "Admin reads orders" on public.orders for select to authenticated using (public.is_admin());
create policy "Admin updates orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin reads order items" on public.order_items for select to authenticated using (public.is_admin());

-- Photos des produits : dossier public en lecture, envoi réservé aux admins (JPG/PNG/WebP, 1 Mo max).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Admin uploads product images" on storage.objects;
drop policy if exists "Admin updates product images" on storage.objects;
drop policy if exists "Admin deletes product images" on storage.objects;
create policy "Admin uploads product images" on storage.objects for insert to authenticated with check (bucket_id = 'products' and public.is_admin());
create policy "Admin updates product images" on storage.objects for update to authenticated using (bucket_id = 'products' and public.is_admin());
create policy "Admin deletes product images" on storage.objects for delete to authenticated using (bucket_id = 'products' and public.is_admin());

-- DEVENIR ADMIN : 1) créez d'abord un compte sur le site avec votre email, 2) remplacez l'email ci-dessous, 3) exécutez.
insert into public.admins (user_id)
select id from auth.users where email = 'VOTRE_EMAIL@exemple.com'
on conflict do nothing;
