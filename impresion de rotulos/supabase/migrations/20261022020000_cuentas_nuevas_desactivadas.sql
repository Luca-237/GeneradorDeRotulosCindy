-- =====================================================================
--  Toda cuenta nueva nace DESACTIVADA.
--
--  Por qué: si el registro público de Supabase queda encendido
--  ("Allow new users to sign up"), cualquiera con la clave pública
--  (que está en la página) podría crearse una cuenta por la API y
--  entrar como operador. Con esto, esa cuenta no ve nada hasta que un
--  superadmin la active.
--
--  Quién activa:
--   - La Edge Function admin-usuarios (al crear un usuario desde la app
--     lo guarda con activo = true).
--   - supabase/primer-superadmin.sql (para el primer superadmin).
--   - Un superadmin desde el panel Usuarios ("Activar").
-- =====================================================================
alter table public.perfiles alter column activo set default false;

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre, activo)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nombre', ''), false)
  on conflict (id) do nothing;
  return new;
end;
$$;
