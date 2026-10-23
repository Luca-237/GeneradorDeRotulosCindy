
revoke insert, update, delete, truncate, references, trigger on public.perfiles from authenticated;
revoke truncate, references, trigger on public.clientes, public.transportes, public.config from authenticated;
revoke delete on public.config from authenticated;

-- Las funciones auxiliares no las necesita alguien sin login
revoke execute on function public.es_superadmin(), public.es_usuario_activo() from anon, public;
grant execute on function public.es_superadmin(), public.es_usuario_activo() to authenticated;
