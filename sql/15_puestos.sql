-- =====================================================================
-- 15_puestos.sql — Puestos del jugador, compartidos con los planteles (PLAN 6.8.1).
-- Correr después de 14 y enseguida volver a correr 07 y 05.
-- Se puede volver a correr.
--
-- Qué cambia en el modelo:
-- - jugadores.puestos (text[]): todos los puestos del jugador (Arquero, Defensor,
--   Volante, Delantero). Reemplaza a jugadores.posicion, que se borra.
-- - Cuando un plantel le pone un puesto al jugador (alta o cambio de
--   planteles.posicion), se suma a jugadores.puestos. Nunca se quita uno.
-- - planteles.posicion solo acepta los 4 puestos (los datos de hoy ya lo cumplen).
-- - v_puestos_jugador: por cada puesto, en cuántos torneos lo jugó y el último.
-- - (6.8.3) Un puesto se puede sumar o quitar a mano desde la pantalla del
--   jugador, pero no se puede quitar uno que algún plantel usa.
-- Qué se rompería y cómo se evita:
-- - v_jugadores_resumen (07) leía jugadores.posicion: se borra acá y 07 la
--   vuelve a crear con puestos y ultimo_puesto. Hasta correr 07, la pantalla
--   Jugadores de admin no carga.
-- - unir_jugadores (07) se quedaba con un puesto: 07 la reemplaza y junta los
--   puestos de los dos. Hasta correr 07, unir jugadores falla.
-- - El registro de cambios (05) reconoce "sumó a / sacó a" aunque el mismo
--   guardado también le sume un puesto al jugador.
-- - Nada se pierde: puestos = los puestos de sus planteles + su posicion de antes,
--   y recién después se borra la columna. La copia no deja filas en la
--   auditoría (el trigger de jugadores se apaga mientras tanto).
-- =====================================================================

-- Los 4 puestos, sin repetir y siempre en el mismo orden; descarta lo que no sea un puesto.
create or replace function ordenar_puestos(p_puestos text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(p order by array_position(array['Arquero', 'Defensor', 'Volante', 'Delantero'], p)), '{}')
  from (select distinct p from unnest(coalesce(p_puestos, '{}')) p
        where p = any (array['Arquero', 'Defensor', 'Volante', 'Delantero'])) x
$$;

alter table jugadores add column if not exists puestos text[] not null default '{}';
alter table jugadores drop constraint if exists jugadores_puestos_chk;
alter table jugadores add constraint jugadores_puestos_chk
  check (puestos <@ array['Arquero', 'Defensor', 'Volante', 'Delantero']::text[]);

alter table planteles drop constraint if exists planteles_posicion_chk;
alter table planteles add constraint planteles_posicion_chk
  check (posicion in ('Arquero', 'Defensor', 'Volante', 'Delantero'));

-- ---------------------------------------------------------------------
-- Carga inicial: solo si todavía existe jugadores.posicion.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'jugadores' and column_name = 'posicion') then
    return;
  end if;
  execute 'alter table jugadores disable trigger user';
  execute $u$
    update jugadores j
    set puestos = ordenar_puestos(j.puestos || array[j.posicion] ||
      coalesce((select array_agg(l.posicion) from planteles l where l.jugador_id = j.jugador_id and l.posicion is not null), '{}'))
  $u$;
  execute 'alter table jugadores enable trigger user';
  if exists (select 1 from jugadores where posicion is not null and not (posicion = any (puestos))) then
    raise exception 'quedaron puestos sin copiar: no se borra la columna vieja';
  end if;
  drop view if exists v_jugadores_resumen;   -- 07 la vuelve a crear
  alter table jugadores drop column posicion;
end;
$$;

-- ---------------------------------------------------------------------
-- Un puesto puesto en un plantel queda en el jugador (nunca se quita).
-- ---------------------------------------------------------------------
create or replace function sumar_puesto()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.posicion is not null then
    update public.jugadores
    set puestos = public.ordenar_puestos(puestos || array[new.posicion])
    where jugador_id = new.jugador_id and not (new.posicion = any (puestos));
  end if;
  return new;
end;
$$;
drop trigger if exists planteles_sumar_puesto on planteles;
create trigger planteles_sumar_puesto after insert or update of posicion on planteles
  for each row execute function sumar_puesto();

-- ---------------------------------------------------------------------
-- No se puede quitar un puesto que algún plantel usa (6.8.3): primero se
-- cambia en esos planteles. Los puestos quedan siempre en el mismo orden.
-- ---------------------------------------------------------------------
create or replace function controlar_puestos()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_puesto text;
  v_torneos text;
  v_cuantos int;
begin
  select x.posicion, regexp_replace(string_agg(x.nombre, ', ' order by x.orden), ', ([^,]*)$', ' y \1'), count(*)
  into v_puesto, v_torneos, v_cuantos
  from (select distinct l.posicion, t.nombre, t.orden
        from public.planteles l
        join public.torneos t on t.torneo_id = l.torneo_id
        where l.jugador_id = new.jugador_id
          and l.posicion = any (old.puestos) and not (l.posicion = any (new.puestos))) x
  group by x.posicion
  order by x.posicion
  limit 1;
  if v_puesto is not null then
    raise exception 'CDM: No se puede quitar %: lo usa en %. Cambialo primero en %.', v_puesto, v_torneos,
      case when v_cuantos = 1 then 'ese plantel' else 'esos planteles' end;
  end if;
  new.puestos := public.ordenar_puestos(new.puestos);
  return new;
end;
$$;
drop trigger if exists jugadores_controlar_puestos on jugadores;
create trigger jugadores_controlar_puestos before update of puestos on jugadores
  for each row execute function controlar_puestos();

-- ---------------------------------------------------------------------
-- Uso de cada puesto: en cuántos torneos y cuál fue el último.
-- Los puestos cargados a mano (sin plantel) salen con 0 torneos.
-- ---------------------------------------------------------------------
drop view if exists v_puestos_jugador;
create view v_puestos_jugador with (security_invoker = true) as
with usados as (
  select l.jugador_id, l.posicion as puesto, count(*) as torneos,
         (array_agg(l.torneo_id order by t.orden desc))[1] as ultimo_torneo_id,
         max(t.orden) as ultimo_orden
  from planteles l
  join torneos t on t.torneo_id = l.torneo_id
  where l.posicion is not null
  group by l.jugador_id, l.posicion
)
select
  j.jugador_id,
  p.puesto,
  coalesce(u.torneos, 0)::int as torneos,
  u.ultimo_torneo_id,
  t.nombre as ultimo_torneo,
  u.ultimo_orden
from jugadores j
cross join lateral unnest(j.puestos) as p(puesto)
left join usados u on u.jugador_id = j.jugador_id and u.puesto = p.puesto
left join torneos t on t.torneo_id = u.ultimo_torneo_id;
grant select on v_puestos_jugador to anon, authenticated;
