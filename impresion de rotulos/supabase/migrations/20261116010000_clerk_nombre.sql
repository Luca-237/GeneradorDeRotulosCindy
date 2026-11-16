-- =====================================================================
--  Cuenta Cindy: el perfil muestra el nombre de Clerk.
--  Claims que usa (Clerk -> Sessions -> Customize session token):
--    username (user.username), nombre (user.first_name), apellido (user.last_name),
--    usuario (public_metadata.usuario, solo para vincular con un usuario de rótulos).
--  - Cuenta Cindy nueva: nombre = nombre y apellido de Clerk, o el username.
--    En "Usuario" se guarda el username de Clerk.
--  - Cuenta solo Cindy (sin usuario de rótulos): en cada ingreso se actualizan
--    nombre y usuario con lo que tenga Clerk. El rol y el estado no se tocan.
--  - Cuenta vinculada a un usuario de rótulos: se respeta el nombre de rótulos.
--  Correr DESPUÉS de 20261116000000_login_clerk.sql. Se puede correr dos veces.
-- =====================================================================

create or replace function public.mi_perfil()
returns table (id uuid, email text, nombre text, rol text, activo boolean, via text, tiene_login_propio boolean)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_sub      text := auth.jwt() ->> 'sub';
  v_id       uuid;
  v_usuario  text := lower(trim(coalesce(auth.jwt() ->> 'usuario', '')));
  v_username text := lower(trim(coalesce(auth.jwt() ->> 'username', '')));
  v_nombre   text := trim(concat_ws(' ', nullif(trim(auth.jwt() ->> 'nombre'), ''), nullif(trim(auth.jwt() ->> 'apellido'), '')));
  v_dominio  constant text := 'rotulos.cindymayorista.com.ar';
  v_activa   boolean;
begin
  if v_sub is null then return; end if;
  v_id := public.mi_perfil_id();

  if v_id is null and public.es_token_clerk() then
    -- Vincular con un usuario de rótulos (solo si un admin cargó "usuario" en Clerk)
    if v_usuario ~ '^[a-z0-9._-]+$' then
      update public.perfiles p set clerk_id = v_sub
      where p.id = (select q.id from public.perfiles q
                    where q.clerk_id is null and lower(q.email) = v_usuario || '@' || v_dominio
                    limit 1)
      returning p.id into v_id;
    end if;

    -- Si no, perfil nuevo con los datos de Clerk
    if v_id is null then
      select coalesce((valor)::text = 'true', true) into v_activa
      from public.config where clave = 'clerk_alta_activa';
      insert into public.perfiles (email, nombre, rol, activo, clerk_id)
      values (coalesce(nullif(v_username, ''), nullif(v_usuario, ''), v_sub),
              coalesce(nullif(v_nombre, ''), nullif(v_username, ''), nullif(v_usuario, ''), ''),
              'operador', coalesce(v_activa, true), v_sub)
      on conflict (clerk_id) do nothing;
      v_id := public.mi_perfil_id();
    end if;
  end if;

  -- Cuenta solo Cindy: nombre y usuario al día con Clerk
  if v_id is not null and public.es_token_clerk() then
    update public.perfiles p
       set nombre = coalesce(nullif(v_nombre, ''), nullif(v_username, ''), p.nombre),
           email  = coalesce(nullif(v_username, ''), p.email)
     where p.id = v_id and p.auth_id is null
       and (p.nombre is distinct from coalesce(nullif(v_nombre, ''), nullif(v_username, ''), p.nombre)
            or p.email is distinct from coalesce(nullif(v_username, ''), p.email));
  end if;

  return query
    select p.id, p.email, p.nombre, p.rol, p.activo,
           case when public.es_token_clerk() then 'clerk' else 'propio' end,
           p.auth_id is not null
    from public.perfiles p where p.id = v_id;
end;
$$;

revoke execute on function public.mi_perfil() from anon, public;
grant execute on function public.mi_perfil() to authenticated;
