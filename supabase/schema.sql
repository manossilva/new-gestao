-- ============================================================
-- Gestão Interna — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Profiles
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  photo_url text,
  role text check (role in ('ramon', 'mano')),
  company_name text default 'Gestão Interna',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Company settings (shared)
create table if not exists company_settings (
  id integer primary key default 1,
  company_name text default 'Gestão Interna',
  updated_at timestamptz default now()
);
alter table company_settings enable row level security;
create policy "Anyone authenticated can view company" on company_settings for select using (auth.role() = 'authenticated');
create policy "Anyone authenticated can update company" on company_settings for update using (auth.role() = 'authenticated');
create policy "Anyone authenticated can insert company" on company_settings for insert with check (auth.role() = 'authenticated');

-- Insert default company settings
insert into company_settings (id, company_name) values (1, 'Gestão Interna') on conflict (id) do nothing;

-- PF Receitas
create table if not exists pf_receitas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  descricao text not null,
  valor decimal(10,2) not null,
  forma_pagamento text not null,
  data date not null,
  created_at timestamptz default now()
);
alter table pf_receitas enable row level security;
create policy "Users can manage own PF receitas" on pf_receitas for all using (auth.uid() = user_id);

-- PJ1 Receitas (Ramon's company)
create table if not exists pj1_receitas (
  id uuid default gen_random_uuid() primary key,
  descricao text not null,
  valor decimal(10,2) not null,
  quem_pagou text not null,
  data date not null,
  created_at timestamptz default now()
);
alter table pj1_receitas enable row level security;
create policy "Anyone authenticated can manage PJ1" on pj1_receitas for all using (auth.role() = 'authenticated');

-- PJ2 Clientes
create table if not exists pj2_clientes (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  contato text,
  created_at timestamptz default now()
);
alter table pj2_clientes enable row level security;
create policy "Anyone authenticated can manage clientes" on pj2_clientes for all using (auth.role() = 'authenticated');

-- PJ2 Servicos
create table if not exists pj2_servicos (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references pj2_clientes(id) on delete set null,
  descricao text not null,
  valor_fechado decimal(10,2) not null default 0,
  gastos decimal(10,2) not null default 0,
  imposto decimal(10,2) not null default 0,
  data_vencimento date,
  created_at timestamptz default now()
);
alter table pj2_servicos enable row level security;
create policy "Anyone authenticated can manage servicos" on pj2_servicos for all using (auth.role() = 'authenticated');

-- Kanban Pipelines
create table if not exists kanban_pipelines (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  ordem integer not null default 0,
  tipo text check (tipo in ('shared', 'personal')) not null,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now()
);
alter table kanban_pipelines enable row level security;
create policy "Shared pipelines visible to all" on kanban_pipelines
  for select using (tipo = 'shared' and auth.role() = 'authenticated');
create policy "Personal pipelines visible to owner" on kanban_pipelines
  for select using (tipo = 'personal' and auth.uid() = user_id);
create policy "Anyone can manage shared pipelines" on kanban_pipelines
  for all using (tipo = 'shared' and auth.role() = 'authenticated');
create policy "Owner can manage personal pipelines" on kanban_pipelines
  for all using (tipo = 'personal' and auth.uid() = user_id);

-- Kanban Tasks
create table if not exists kanban_tarefas (
  id uuid default gen_random_uuid() primary key,
  pipeline_id uuid references kanban_pipelines(id) on delete cascade,
  titulo text not null,
  descricao text,
  ordem integer not null default 0,
  tipo text check (tipo in ('shared', 'personal')) not null,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now()
);
alter table kanban_tarefas enable row level security;
create policy "Shared tasks visible to all" on kanban_tarefas
  for select using (tipo = 'shared' and auth.role() = 'authenticated');
create policy "Personal tasks visible to owner" on kanban_tarefas
  for select using (tipo = 'personal' and auth.uid() = user_id);
create policy "Anyone can manage shared tasks" on kanban_tarefas
  for all using (tipo = 'shared' and auth.role() = 'authenticated');
create policy "Owner can manage personal tasks" on kanban_tarefas
  for all using (tipo = 'personal' and auth.uid() = user_id);

-- ============================================================
-- Storage bucket for avatars
-- Run in Supabase Dashboard > Storage > Create bucket "avatars" (public)
-- Or run:
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
-- ============================================================

-- After creating users in auth.users, manually set their role in profiles:
-- update profiles set role = 'ramon', name = 'Ramon' where id = '<ramon-uuid>';
-- update profiles set role = 'mano', name = 'Mano' where id = '<mano-uuid>';

-- Storage policies for avatars bucket
create policy "Allow authenticated uploads to avatars" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars');

create policy "Allow public reads on avatars" on storage.objects
  for select to public
  using (bucket_id = 'avatars');

create policy "Allow authenticated updates on avatars" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars');

create policy "Allow authenticated deletes on avatars" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars');

-- Add pj1_company_name to profiles (Ramon's company name)
alter table profiles add column if not exists pj1_company_name text default 'PJ1 — Empresa';

-- Add pj1_company_name column to profiles if not exists
-- alter table profiles add column if not exists pj1_company_name text default 'PJ1 — Empresa';

-- Storage policies (run these if you get upload errors):
-- create policy "Allow uploads" on storage.objects for insert to authenticated with check (bucket_id = 'avatars');
-- create policy "Allow reads" on storage.objects for select to public using (bucket_id = 'avatars');
-- create policy "Allow updates" on storage.objects for update to authenticated using (bucket_id = 'avatars');
