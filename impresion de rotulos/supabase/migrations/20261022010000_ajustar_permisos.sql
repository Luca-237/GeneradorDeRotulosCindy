-- =====================================================================
--  Ajuste de permisos (doble protección además de RLS).
--  Supabase da por defecto TODOS los permisos a "authenticated" sobre las
--  tablas nuevas. RLS ya bloquea lo que no tiene política, pero acá se
--  quitan también a nivel de permisos:
--   - perfiles: desde el navegador solo se lee (el rol lo cambia la Edge Function).
--   - TRUNCATE / REFERENCES / TRIGGER: nadie los necesita desde la app
--     (TRUNCATE además no respeta RLS).
-- =====================================================================
revoke insert, update, delete, truncate, references, trigger on public.perfiles from authenticated;
revoke truncate, references, trigger on public.clientes, public.transportes, public.config from authenticated;
revoke delete on public.config from authenticated;

-- Las funciones auxiliares no las necesita alguien sin login
revoke execute on function public.es_superadmin(), public.es_usuario_activo() from anon, public;
grant execute on function public.es_superadmin(), public.es_usuario_activo() to authenticated;
