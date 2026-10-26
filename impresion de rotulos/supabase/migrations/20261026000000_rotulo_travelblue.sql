-- Rótulo Travel Blue: solo superadmin.
-- Su configuración (remitente_travelblue) solo la puede leer un superadmin;
-- el resto de la config sigue igual (la leen todos los usuarios activos).

drop policy if exists config_select on public.config;
create policy config_select on public.config
  for select to authenticated
  using (public.es_usuario_activo() and (clave not like '%travelblue%' or public.es_superadmin()));

insert into public.config (clave, valor) values
  ('remitente_travelblue', '["BAG STORE S.R.L CUIT:30-71455926-1", "TEL: 3534 06-2150", "EMAIL: INFO@TRAVELBLUE.COM.AR", "(CON ENTREGA EN DOMICILIO)"]'::jsonb)
on conflict (clave) do nothing;
