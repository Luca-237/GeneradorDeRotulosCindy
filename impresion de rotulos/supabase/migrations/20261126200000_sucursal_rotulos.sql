-- =====================================================================
--  Rótulos y remitos por sucursal (pedido de Luca, 26/11/2026).
--
--  - perfiles.sucursal: la sucursal de cada usuario de rótulos ('central' o
--    'cordoba', las claves de fac_sucursales de Facturación y despacho).
--    Con eso la página elige el rótulo, el remitente y el remito de esa sucursal.
--  - La primera vez se copia lo que ya estaba tildado en Facturación: quien
--    tiene solo Córdoba queda en Córdoba; el resto, en Central.
--  - La cambia un superadmin desde Usuarios (función asignar_sucursal).
--  - sucursales_rotulos(): lista de sucursales activas para la página (la tabla
--    fac_sucursales solo la leen los usuarios de Facturación).
--  - Lo propio de cada sucursal (remitente, posiciones del remito) va en la
--    tabla config, con claves como 'remitente_cordoba': no hace falta tabla nueva.
--
--  Correr DESPUÉS de las migraciones de Facturación (usa fac_sucursales y
--  fac_usuarios). Se puede correr dos veces.
--  Aplicada en producción el 26/11/2026 (Santiago Solis quedó en Córdoba; el resto, en Central).
-- =====================================================================

do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'perfiles' and column_name = 'sucursal') then
    alter table public.perfiles add column sucursal text not null default 'central'
      check (sucursal ~ '^[a-z][a-z0-9_]*$');
    -- Solo la primera vez: lo tildado en Facturación (si tiene únicamente Córdoba)
    update public.perfiles p set sucursal = 'cordoba'
    where exists (select 1 from public.fac_usuarios u
                  where u.perfil_id = p.id and u.sucursales = '{cordoba}'::text[]);
  end if;
end $$;

-- Sucursales activas (clave y nombre) para cualquier usuario activo de rótulos
create or replace function public.sucursales_rotulos()
returns table (clave text, nombre text)
language sql stable security definer set search_path = public
as $$
  select s.clave, s.nombre from public.fac_sucursales s
  where s.activa and public.es_usuario_activo()
  order by s.orden, s.nombre;
$$;

-- La sucursal del usuario logueado
create or replace function public.mi_sucursal()
returns text
language sql stable security definer set search_path = public
as $$
  select p.sucursal from public.perfiles p where p.id = public.mi_perfil_id();
$$;

-- Cambiar la sucursal de un usuario (solo superadmin)
create or replace function public.asignar_sucursal(p_perfil uuid, p_sucursal text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'Solo un superadmin puede cambiar la sucursal de un usuario.';
  end if;
  if not exists (select 1 from public.fac_sucursales s where s.clave = p_sucursal and s.activa) then
    raise exception 'La sucursal "%" no existe o no está activa.', p_sucursal;
  end if;
  update public.perfiles set sucursal = p_sucursal where id = p_perfil;
  if not found then
    raise exception 'No existe ese usuario.';
  end if;
end;
$$;

revoke execute on function public.sucursales_rotulos(), public.mi_sucursal(), public.asignar_sucursal(uuid, text) from anon, public;
grant execute on function public.sucursales_rotulos(), public.mi_sucursal(), public.asignar_sucursal(uuid, text) to authenticated;
