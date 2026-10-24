-- =====================================================================
-- 07_jugadores_escudos.sql — Fase 4.5.3 y 4.5.4: corregir y unir jugadores,
-- y escudos de los equipos. Correr después de 05 (y de 06). Se puede volver a correr.
--
-- Qué se rompe: nada.
-- - equipos.escudo es una columna nueva (vacía = se muestran las iniciales).
-- - unir_jugadores y v_jugadores_resumen son nuevas.
-- - El bucket "escudos" de Storage es nuevo y público (solo lectura para todos;
--   subir o cambiar archivos, solo administradores).
-- =====================================================================

-- ---------- Escudos ----------
alter table equipos add column if not exists escudo text;   -- URL o ruta (assets/escudos/MIT.png)

insert into storage.buckets (id, name, public)
values ('escudos', 'escudos', true)
on conflict (id) do update set public = true;

drop policy if exists escudos_leer_admin on storage.objects;
create policy escudos_leer_admin on storage.objects for select to authenticated
  using (bucket_id = 'escudos' and public.es_admin());
drop policy if exists escudos_subir on storage.objects;
create policy escudos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'escudos' and public.es_admin());
drop policy if exists escudos_cambiar on storage.objects;
create policy escudos_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'escudos' and public.es_admin()) with check (bucket_id = 'escudos' and public.es_admin());
drop policy if exists escudos_borrar on storage.objects;
create policy escudos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'escudos' and public.es_admin());

-- ---------- Jugadores: resumen para la pantalla de corrección ----------
drop view if exists v_jugadores_resumen;
create view v_jugadores_resumen with (security_invoker = true) as
with apariciones as (
  select g.jugador_id, g.partido_id, v.anio, (g.tipo <> 'En contra') as es_gol
  from goles g join v_partidos v on v.partido_id = g.partido_id
  where g.jugador_id is not null
  union all
  select f.jugador_id, f.partido_id, v.anio, false
  from formaciones f join v_partidos v on v.partido_id = f.partido_id
  union all
  select i.jugador_id, i.partido_id, v.anio, false
  from incidencias i join v_partidos v on v.partido_id = i.partido_id
  where i.jugador_id is not null
)
select
  j.jugador_id,
  j.apellido,
  j.nombre,
  j.apodo,
  j.posicion,
  j.division,
  j.notas,
  coalesce(array_agg(distinct a.anio order by a.anio) filter (where a.anio is not null), '{}') as anios,
  count(*) filter (where a.es_gol) as goles,
  count(distinct a.partido_id) as partidos
from jugadores j
left join apariciones a on a.jugador_id = j.jugador_id
group by j.jugador_id;
grant select on v_jugadores_resumen to anon, authenticated;

-- ---------- Unir dos jugadores (el que sobra pasa al que queda) ----------
-- Pasa goles, incidencias, sanciones, formaciones y goleadores de la Liga, completa los datos
-- vacíos del que queda con los del que sobra, junta las notas y borra el sobrante.
-- Si los dos están en la misma formación de un partido, no une (sería el mismo partido dos veces).
create or replace function unir_jugadores(p_queda text, p_sobra text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  q public.jugadores;
  s public.jugadores;
  v_mismos int;
  v_goles int;
  v_incid int;
  v_form int;
begin
  if not public.es_admin() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if p_queda = p_sobra then
    raise exception 'CDM: Elegí dos jugadores distintos.';
  end if;
  select * into q from public.jugadores where jugador_id = p_queda;
  select * into s from public.jugadores where jugador_id = p_sobra;
  if q.jugador_id is null or s.jugador_id is null then
    raise exception 'CDM: No se encontró uno de los jugadores. Recargá la página.';
  end if;

  select count(*) into v_mismos
  from public.formaciones a
  join public.formaciones b on b.partido_id = a.partido_id and b.jugador_id = p_queda
  where a.jugador_id = p_sobra;
  if v_mismos > 0 then
    raise exception 'CDM: Los dos aparecen en la misma formación (%). Son jugadores distintos o hay un error en la formación: no se unen.',
      v_mismos || case when v_mismos = 1 then ' partido' else ' partidos' end;
  end if;

  update public.goles set jugador_id = p_queda where jugador_id = p_sobra;
  get diagnostics v_goles = row_count;
  update public.incidencias set jugador_id = p_queda where jugador_id = p_sobra;
  get diagnostics v_incid = row_count;
  update public.formaciones set jugador_id = p_queda where jugador_id = p_sobra;
  get diagnostics v_form = row_count;
  update public.sanciones set jugador_id = p_queda where jugador_id = p_sobra;
  -- Listas de jugadores (10_planteles.sql): si los dos estaban en la misma, queda una sola fila
  if to_regclass('public.planteles') is not null then
    execute 'delete from public.planteles s using public.planteles q
             where s.jugador_id = $1 and q.jugador_id = $2 and q.torneo_id = s.torneo_id and q.categoria = s.categoria'
      using p_sobra, p_queda;
    execute 'update public.planteles set jugador_id = $2 where jugador_id = $1' using p_sobra, p_queda;
  end if;
  update public.goleadores_liga set jugador_id = p_queda where jugador_id = p_sobra;

  update public.jugadores set
    nombre = coalesce(nullif(trim(q.nombre), ''), s.nombre),
    apodo = coalesce(nullif(trim(q.apodo), ''), s.apodo),
    posicion = coalesce(nullif(trim(q.posicion), ''), s.posicion),
    division = case when q.division is null then s.division
                    when s.division is null or s.division = q.division then q.division
                    else 'Ambas' end,
    fuente_ids = (select coalesce(array_agg(distinct x), '{}') from unnest(q.fuente_ids || s.fuente_ids) x),
    notas = nullif(concat_ws(' · ', nullif(trim(q.notas), ''), nullif(trim(s.notas), ''),
              'Unido con ' || s.apellido || coalesce(', ' || nullif(trim(s.nombre), ''), '')), '')
  where jugador_id = p_queda;

  delete from public.jugadores where jugador_id = p_sobra;

  return jsonb_build_object('goles', v_goles, 'incidencias', v_incid, 'formaciones', v_form);
end;
$$;
revoke execute on function unir_jugadores(text, text) from public, anon;
grant execute on function unir_jugadores(text, text) to authenticated;
