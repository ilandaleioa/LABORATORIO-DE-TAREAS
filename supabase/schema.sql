-- Laboratorio de Tareas · esquema de Supabase
-- Ejecutar en: Supabase → SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.ejercicios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text not null default '',
  imagen_url text not null,
  categoria text,
  created_at timestamptz not null default now()
);

create table if not exists public.analisis (
  id uuid primary key default gen_random_uuid(),
  ejercicio_id uuid not null references public.ejercicios(id) on delete cascade,
  puntos_clave jsonb not null default '[]',
  roles jsonb not null default '[]',
  dinamica_general text not null default '',
  impacto_modificadores text,
  modificadores jsonb not null default '{"comodines":0,"porterias":0}',
  es_version_modificada boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists analisis_ejercicio_idx on public.analisis (ejercicio_id, created_at desc);
create index if not exists ejercicios_categoria_idx on public.ejercicios (categoria);

-- Storage: bucket público para las imágenes
insert into storage.buckets (id, name, public)
values ('ejercicios', 'ejercicios', true)
on conflict (id) do nothing;

-- Row Level Security
alter table public.ejercicios enable row level security;
alter table public.analisis enable row level security;

-- MODO USUARIO ÚNICO: acceso abierto con la clave anon.
-- Cualquiera con la URL de la app podría leer/escribir. Si la app se hace
-- pública o multiusuario, sustituye estas políticas por otras basadas en auth.uid()
-- (añade una columna user_id y filtra por ella).
drop policy if exists "ejercicios_all" on public.ejercicios;
create policy "ejercicios_all" on public.ejercicios for all to anon using (true) with check (true);

drop policy if exists "analisis_all" on public.analisis;
create policy "analisis_all" on public.analisis for all to anon using (true) with check (true);

drop policy if exists "imagenes_leer" on storage.objects;
create policy "imagenes_leer" on storage.objects for select to anon using (bucket_id = 'ejercicios');

drop policy if exists "imagenes_subir" on storage.objects;
create policy "imagenes_subir" on storage.objects for insert to anon with check (bucket_id = 'ejercicios');
