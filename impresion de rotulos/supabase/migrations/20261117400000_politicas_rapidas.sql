-- =====================================================================
--  Cuenta Cindy - paso 3: políticas rápidas (correr DESPUÉS de la migración).
--  Copiar a supabase/migrations/AAAAMMDDHHMMSS_politicas_rapidas.sql.
--
--  Después de la migración, mi_perfil_id() y las funciones que la usan
--  (es_admin(), es_usuario_activo(), puede_cargar(), es_superadmin()...) leen
--  el token (auth.jwt()) en cada llamada. Dentro de una política se llaman
--  una vez POR FILA: con tablas de miles de filas la página queda en
--  "Cargando" o corta por "statement timeout" (Compras: 42 ms -> 4 s).
--  Envueltas en (select ...) Postgres las calcula una sola vez por consulta
--  (lo que recomienda Supabase para auth.uid()). El resultado es el mismo.
--  Solo toca llamadas SIN argumentos; las que reciben una columna de la fila
--  (ej. puede_ver(local_id)) quedan igual.
--  Se puede correr dos veces (no vuelve a envolver lo ya envuelto).
-- =====================================================================
do $$
declare
  r record;
  v_roles text;
  v_qual text;
  v_check text;
  v_patron constant text := '(?<!SELECT )\m(public\.)?(es_[a-z0-9_]+|puede_[a-z0-9_]+|mi_perfil_id)\(\)';
  v_reemplazo constant text := '(select public.\2())';
begin
  for r in select * from pg_policies
           where schemaname = 'public'
             and coalesce(qual, '') || ' ' || coalesce(with_check, '') ~ v_patron
  loop
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ')
      into v_roles from unnest(r.roles) x;
    v_qual  := regexp_replace(r.qual, v_patron, v_reemplazo, 'g');
    v_check := regexp_replace(r.with_check, v_patron, v_reemplazo, 'g');
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    execute format('create policy %I on public.%I as %s for %s to %s%s%s',
      r.policyname, r.tablename, r.permissive, r.cmd, v_roles,
      case when v_qual is not null then ' using (' || v_qual || ')' else '' end,
      case when v_check is not null then ' with check (' || v_check || ')' else '' end);
  end loop;
end $$;
