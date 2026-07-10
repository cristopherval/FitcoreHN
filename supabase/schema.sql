-- =========================================================================
-- FITCORE HN — Esquema de Supabase
-- Ejecuta TODO este archivo en: Supabase → SQL Editor → New query → Run
-- =========================================================================

-- ============ 1. TABLAS ============

create table if not exists categorias (
  id          text primary key,          -- 'creatinas', 'proteinas', ...
  nombre      text not null,             -- 'Creatinas'
  descripcion text,
  orden       int default 0
);

create table if not exists productos (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  descripcion     text,
  precio          numeric not null,      -- precio de venta (lo que paga el cliente)
  precio_anterior numeric,               -- precio tachado (null = sin promo)
  categoria_id    text references categorias(id) on delete set null,
  imagen_url      text,                  -- URL de Supabase Storage o ruta 'assets/...'
  destacado       boolean default false, -- aparece en "Nuestros más vendidos"
  en_ofertas      boolean default false, -- aparece en "Ofertas de la semana"
  orden           int default 0,
  creado_at       timestamptz default now()
);

-- ============ 2. SEGURIDAD (RLS) ============
-- Cualquiera puede LEER (la tienda es pública).
-- Solo usuarios autenticados (tú) pueden crear/editar/borrar.

alter table categorias enable row level security;
alter table productos  enable row level security;

drop policy if exists "lectura publica categorias" on categorias;
create policy "lectura publica categorias"
  on categorias for select using (true);

drop policy if exists "lectura publica productos" on productos;
create policy "lectura publica productos"
  on productos for select using (true);

drop policy if exists "admin escribe categorias" on categorias;
create policy "admin escribe categorias"
  on categorias for all to authenticated using (true) with check (true);

drop policy if exists "admin escribe productos" on productos;
create policy "admin escribe productos"
  on productos for all to authenticated using (true) with check (true);

-- ============ 3. ALMACENAMIENTO DE IMÁGENES ============
-- Bucket público 'productos': las fotos se ven sin login,
-- pero solo tú (autenticado) puedes subirlas o borrarlas.

insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

drop policy if exists "imagenes lectura publica" on storage.objects;
create policy "imagenes lectura publica"
  on storage.objects for select using (bucket_id = 'productos');

drop policy if exists "imagenes sube admin" on storage.objects;
create policy "imagenes sube admin"
  on storage.objects for insert to authenticated with check (bucket_id = 'productos');

drop policy if exists "imagenes actualiza admin" on storage.objects;
create policy "imagenes actualiza admin"
  on storage.objects for update to authenticated using (bucket_id = 'productos');

drop policy if exists "imagenes borra admin" on storage.objects;
create policy "imagenes borra admin"
  on storage.objects for delete to authenticated using (bucket_id = 'productos');
