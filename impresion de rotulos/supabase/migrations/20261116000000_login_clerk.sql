-- =====================================================================
--  Doble login: cuenta Cindy (Clerk) + usuario propio de rótulos.
--  Los dos conviven. Un perfil puede tener uno, otro o los dos:
--    auth_id  -> usuario del login propio (auth.users de este proyecto)
--    clerk_id -> usuario de Clerk (sub del token, "user_...")
--  Requiere: Supabase -> Authentication -> Third Party Auth -> Clerk.
--  Correr DESPUÉS de las migraciones anteriores. Se puede correr dos veces.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) perfiles: el id deja de ser el id de auth.users
-- ---------------------------------------------------------------------
alter table public.perfiles add column if not exists auth_id uuid;
alter table public.perfiles add column if not exists clerk_id text;

update public.perfiles p set auth_id = p.id
where p.auth_id is null and exists (select 1 from auth.users u where u.id = p.id);

alter table public.perfiles drop constraint if exists perfiles_id_fkey;
alter table public.perfiles alter column id set default gen_random_uuid();

alter table public.perfiles drop constraint if exists perfiles_auth_id_fkey;
alter table public.perfiles add constraint perfiles_auth_id_fkey
  foreign key (auth_id) references auth.users(id) on delete set null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfiles_auth_id_key') then
    alter table public.perfiles add constraint perfiles_auth_id_key unique (auth_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'perfiles_clerk_id_key') then
    alter table public.perfiles add constraint perfiles_clerk_id_key unique (clerk_id);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) ¿Quién soy? Sirve para los dos tipos de token.
--    No usar auth.uid(): convierte el sub a uuid y el de Clerk no lo es.
-- ---------------------------------------------------------------------
create or replace function public.mi_perfil_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select p.id from public.perfiles p
  where (auth.jwt() ->> 'sub') is not null
    and (p.auth_id::text = auth.jwt() ->> 'sub' or p.clerk_id = auth.jwt() ->> 'sub')
  limit 1;
$$;

-- Token emitido por Clerk (y no por el Auth de este proyecto)
create or replace function public.es_token_clerk()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'sub', '') like 'user\_%'
     and coalesce(auth.jwt() ->> 'iss', '') !~ '/auth/v1$';
$$;

create or replace function public.es_superadmin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles
                 where id = public.mi_perfil_id() and rol = 'superadmin' and activo);
$$;

create or replace function public.es_usuario_activo()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = public.mi_perfil_id() and activo);
$$;

drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select to authenticated
  using (id = public.mi_perfil_id() or public.es_superadmin());

-- ---------------------------------------------------------------------
-- 3) "Creado por" / "actualizado por" apuntan a perfiles (no a auth.users)
-- ---------------------------------------------------------------------
alter table public.clientes drop constraint if exists clientes_creado_por_fkey;
alter table public.clientes drop constraint if exists clientes_actualizado_por_fkey;
alter table public.config   drop constraint if exists config_actualizado_por_fkey;

alter table public.clientes add constraint clientes_creado_por_fkey
  foreign key (creado_por) references public.perfiles(id) on delete set null not valid;
alter table public.clientes add constraint clientes_actualizado_por_fkey
  foreign key (actualizado_por) references public.perfiles(id) on delete set null not valid;
alter table public.config add constraint config_actualizado_por_fkey
  foreign key (actualizado_por) references public.perfiles(id) on delete set null not valid;

alter table public.clientes alter column creado_por      set default public.mi_perfil_id();
alter table public.clientes alter column actualizado_por set default public.mi_perfil_id();
alter table public.config   alter column actualizado_por set default public.mi_perfil_id();

create or replace function public.marcar_actualizacion()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  new.actualizado_por := public.mi_perfil_id();
  return new;
end;
$$;

-- Alta en el login propio: el perfil guarda el auth_id
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, auth_id, email, nombre, activo)
  values (new.id, new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nombre', ''), false)
  on conflict do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) Cuentas Cindy nuevas: ¿entran activas? (fase 1: sí, como operador)
-- ---------------------------------------------------------------------
insert into public.config (clave, valor) values ('clerk_alta_activa', 'true'::jsonb)
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- 5) mi_perfil(): lo llama la página al entrar.
--    Con token de Clerk, la primera vez vincula la cuenta:
--      - claim "usuario" (public_metadata.usuario, lo pone un admin) = usuario
--        del login propio ("luca") -> se vincula a ese perfil;
--      - si no hay coincidencia -> perfil nuevo de operador.
--    No se usa el username de Clerk porque cada persona lo puede cambiar.
-- ---------------------------------------------------------------------
drop function if exists public.mi_perfil();
create function public.mi_perfil()
returns table (id uuid, email text, nombre text, rol text, activo boolean, via text, tiene_login_propio boolean)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_sub     text := auth.jwt() ->> 'sub';
  v_id      uuid;
  v_usuario text := lower(trim(coalesce(auth.jwt() ->> 'usuario', '')));
  v_nombre  text := trim(concat_ws(' ', nullif(trim(auth.jwt() ->> 'nombre'), ''), nullif(trim(auth.jwt() ->> 'apellido'), '')));
  v_dominio constant text := 'rotulos.cindymayorista.com.ar';
  v_activa  boolean;
begin
  if v_sub is null then return; end if;
  v_id := public.mi_perfil_id();

  if v_id is null and public.es_token_clerk() then
    if v_usuario ~ '^[a-z0-9._-]+$' then
      update public.perfiles p set clerk_id = v_sub
      where p.id = (select q.id from public.perfiles q
                    where q.clerk_id is null and lower(q.email) = v_usuario || '@' || v_dominio
                    limit 1)
      returning p.id into v_id;
    end if;

    if v_id is null then
      select coalesce((valor)::text = 'true', true) into v_activa
      from public.config where clave = 'clerk_alta_activa';
      insert into public.perfiles (email, nombre, rol, activo, clerk_id)
      values (coalesce(nullif(v_usuario, ''), v_sub),
              coalesce(nullif(v_nombre, ''), nullif(v_usuario, ''), ''),
              'operador', coalesce(v_activa, true), v_sub)
      on conflict (clerk_id) do nothing;
      v_id := public.mi_perfil_id();
    end if;
  end if;

  return query
    select p.id, p.email, p.nombre, p.rol, p.activo,
           case when public.es_token_clerk() then 'clerk' else 'propio' end,
           p.auth_id is not null
    from public.perfiles p where p.id = v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) Permisos de las funciones
-- ---------------------------------------------------------------------
revoke execute on function public.mi_perfil_id(), public.es_token_clerk(), public.mi_perfil(),
  public.es_superadmin(), public.es_usuario_activo() from anon, public;
grant execute on function public.mi_perfil_id(), public.es_token_clerk(), public.mi_perfil(),
  public.es_superadmin(), public.es_usuario_activo() to authenticated;
