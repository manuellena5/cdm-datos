-- =====================================================================
-- 11_fechas_libres_quien.sql — Quién marcó cada fecha libre (6.5.1:
-- "Dep. Mitre libre · marcado por Manuel el 23/10"). Correr después de 10.
-- Se puede volver a correr.
-- Qué se rompe: nada. Es una columna nueva; se completa sola al marcar.
-- =====================================================================

alter table fechas_libres add column if not exists creado_por text;

create or replace function poner_creado_por()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.creado_por is null then
    select nombre into new.creado_por from public.administradores where user_id = auth.uid();
  end if;
  return new;
end;
$$;
revoke execute on function poner_creado_por() from public, anon;

drop trigger if exists fechas_libres_creado_por on fechas_libres;
create trigger fechas_libres_creado_por before insert on fechas_libres
  for each row execute function poner_creado_por();
