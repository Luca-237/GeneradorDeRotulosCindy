
create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  nombre     text not null default '',
  rol        text not null default 'operador' check (rol in ('superadmin', 'operador')),
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create or replace function public.es_superadmin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'superadmin' and activo);
$$;

-- ¿El usuario logueado tiene un perfil activo? (cualquier rol)
create or replace function public.es_usuario_activo()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo);
$$;

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nombre', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- Usuarios que ya existieran antes de correr este script
insert into public.perfiles (id, email, nombre)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'nombre', '')
from auth.users u
on conflict (id) do nothing;

-- Nunca puede quedar el sistema sin un superadmin activo
create or replace function public.proteger_ultimo_superadmin()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.rol = 'superadmin' and old.activo
     and (tg_op = 'DELETE' or new.rol <> 'superadmin' or not new.activo)
     and not exists (select 1 from public.perfiles
                     where rol = 'superadmin' and activo and id <> old.id) then
    raise exception 'No se puede quitar el último superadmin activo';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists proteger_superadmin on public.perfiles;
create trigger proteger_superadmin
  before update or delete on public.perfiles
  for each row execute function public.proteger_ultimo_superadmin();

-- ---------------------------------------------------------------------
-- 2) Clientes (datos sensibles: DNI/CUIT, teléfono, email, dirección)
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (length(trim(nombre)) > 0),
  direccion       text not null default '',
  ciudad          text not null default '',
  provincia       text not null default '',
  cp              text not null default '',
  dni             text not null default '',
  tel             text not null default '',
  email           text not null default '',
  transporte      text not null default '',
  creado_en       timestamptz not null default now(),
  creado_por      uuid default auth.uid() references auth.users(id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid default auth.uid() references auth.users(id) on delete set null
);
create index if not exists clientes_nombre_idx on public.clientes (nombre);
create index if not exists clientes_dni_idx on public.clientes (dni);

create or replace function public.marcar_actualizacion()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;

drop trigger if exists clientes_actualizacion on public.clientes;
create trigger clientes_actualizacion
  before update on public.clientes
  for each row execute function public.marcar_actualizacion();

-- ---------------------------------------------------------------------
-- 3) Transportes (lista del desplegable)
-- ---------------------------------------------------------------------
create table if not exists public.transportes (
  id         bigint generated always as identity primary key,
  nombre     text not null unique check (length(trim(nombre)) > 0),
  orden      int not null default 100,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

insert into public.transportes (nombre, orden) values
  ('VIA CARGO', 1), ('CREDIFIN', 2), ('BUSPACK', 3), ('PRIVITERA', 4), ('COMISIONISTA', 5),
  ('COMISIONISTA-DESDE CBA', 6), ('INTERPROVINCIAL', 7), ('ALPHA', 8), ('TRANSPORTE PAMPERO', 9),
  ('INTEGRAL PACK', 10), ('TIM-CAR', 11), ('ENTREGA A DOMICILIO', 12), ('RETIRA EN LOCAL', 13)
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------
-- 4) Configuración compartida (por ahora: remitente por defecto)
-- ---------------------------------------------------------------------
create table if not exists public.config (
  clave           text primary key,
  valor           jsonb not null,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid default auth.uid() references auth.users(id) on delete set null
);

drop trigger if exists config_actualizacion on public.config;
create trigger config_actualizacion
  before update on public.config
  for each row execute function public.marcar_actualizacion();

insert into public.config (clave, valor) values
  ('remitente', '["BAG STORE S.R.L CUIT:30-71455926-1", "VILLA MARIA", "TEL:3535697189", "EMAIL: VENTASVM.CINDY@GMAIL.COM"]'::jsonb)
on conflict (clave) do nothing;

alter table public.perfiles    enable row level security;
alter table public.clientes    enable row level security;
alter table public.transportes enable row level security;
alter table public.config      enable row level security;

revoke all on public.perfiles, public.clientes, public.transportes, public.config from anon;
grant select on public.perfiles to authenticated;
grant select, insert, update, delete on public.clientes to authenticated;
grant select, insert, update, delete on public.transportes to authenticated;
grant select, insert, update on public.config to authenticated;
grant execute on function public.es_superadmin(), public.es_usuario_activo() to authenticated;

-- perfiles: cada uno ve el suyo; el superadmin ve todos. Nadie escribe desde el navegador.
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.es_superadmin());

-- clientes
drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes
  for select to authenticated using (public.es_usuario_activo());

drop policy if exists clientes_insert on public.clientes;
create policy clientes_insert on public.clientes
  for insert to authenticated with check (public.es_usuario_activo());

drop policy if exists clientes_update on public.clientes;
create policy clientes_update on public.clientes
  for update to authenticated
  using (public.es_usuario_activo()) with check (public.es_usuario_activo());

drop policy if exists clientes_delete on public.clientes;
create policy clientes_delete on public.clientes
  for delete to authenticated using (public.es_superadmin());

-- transportes
drop policy if exists transportes_select on public.transportes;
create policy transportes_select on public.transportes
  for select to authenticated using (public.es_usuario_activo());

drop policy if exists transportes_insert on public.transportes;
create policy transportes_insert on public.transportes
  for insert to authenticated with check (public.es_usuario_activo());

drop policy if exists transportes_update on public.transportes;
create policy transportes_update on public.transportes
  for update to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());

drop policy if exists transportes_delete on public.transportes;
create policy transportes_delete on public.transportes
  for delete to authenticated using (public.es_superadmin());

-- config
drop policy if exists config_select on public.config;
create policy config_select on public.config
  for select to authenticated using (public.es_usuario_activo());

drop policy if exists config_insert on public.config;
create policy config_insert on public.config
  for insert to authenticated with check (public.es_superadmin());

drop policy if exists config_update on public.config;
create policy config_update on public.config
  for update to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());
