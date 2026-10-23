
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
