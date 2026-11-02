-- =====================================================================
-- 14_arbitros.sql — Árbitros con código propio (PLAN 6.7.3).
-- Correr después de 13 y enseguida volver a correr 05.
-- Se puede volver a correr.
--
-- Qué cambia en el modelo:
-- - Tabla nueva `arbitros` (arbitro_id 'A001', nombre, notas).
-- - partidos.arbitro (texto) pasa a partidos.arbitro_id (código). Así un
--   nombre corregido cambia en todos sus partidos y dos formas de escribir
--   al mismo árbitro se unen en un solo código.
-- Qué se rompería y cómo se evita:
-- - v_partidos leía partidos.arbitro: acá se reemplaza por una versión que
--   lee el nombre desde `arbitros` (misma columna `arbitro`, más `arbitro_id`
--   al final), y recién después se borra la columna vieja. Las vistas que
--   salen de v_partidos no cambian y no hace falta volver a correr 02.
-- - guardar_partido escribía partidos.arbitro: hasta volver a correr 05,
--   guardar un partido falla. Correr 05 enseguida.
-- - Nada se pierde: cada texto pasa a su código antes de borrar la columna.
--   El paso a código no toca actualizado_en ni deja filas en el registro de
--   cambios (los triggers de partidos se apagan mientras tanto).
-- Nombres: "PARIANI AGUSTÍN" (apellido y nombre en mayúsculas) queda
-- "Agustín Pariani"; el resto, tal cual (sin espacios de más). Los que
-- están escritos de dos formas se unen desde Administrar → Árbitros.
-- =====================================================================

create table if not exists arbitros (
  arbitro_id  text primary key,                          -- 'A001'
  nombre      text not null constraint arbitros_nombre_chk check (trim(nombre) <> ''),
  notas       text,
  creado_en   timestamptz not null default now()
);
create unique index if not exists arbitros_nombre_unico on arbitros (lower(trim(nombre)));

alter table partidos add column if not exists arbitro_id text references arbitros (arbitro_id) on update cascade;
create index if not exists partidos_arbitro_idx on partidos (arbitro_id);

alter table arbitros enable row level security;
drop policy if exists lectura on arbitros;
create policy lectura on arbitros for select to anon, authenticated using (true);
drop policy if exists escritura_admin on arbitros;
create policy escritura_admin on arbitros for all to authenticated using (es_admin()) with check (es_admin());
revoke insert, update, delete, truncate on arbitros from anon;
grant select on arbitros to anon, authenticated;
grant insert, update, delete on arbitros to authenticated;

-- "PARIANI AGUSTÍN" → "Agustín Pariani"; "Jorge  Rhull " → "Jorge Rhull"
create or replace function nombre_arbitro(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when t = '' then null
    when t = upper(t) and t ~ '^\S+ \S+$' then initcap(split_part(t, ' ', 2)) || ' ' || initcap(split_part(t, ' ', 1))
    when t = upper(t) then initcap(t)
    else t
  end
  from (select regexp_replace(trim(coalesce(p_texto, '')), '\s+', ' ', 'g') as t) x
$$;

-- Código del árbitro con ese nombre; si no existe, lo crea (A001, A002…).
create or replace function crear_arbitro(p_nombre text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nombre text := public.nombre_arbitro(p_nombre);
  v_id text;
begin
  if not public.es_admin() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if v_nombre is null then
    raise exception 'falta el nombre del árbitro' using errcode = '22023';
  end if;
  select arbitro_id into v_id from public.arbitros where lower(trim(nombre)) = lower(v_nombre);
  if v_id is not null then
    return v_id;
  end if;
  select 'A' || lpad((coalesce(max(substring(arbitro_id from 2)::int), 0) + 1)::text, 3, '0')
    into v_id
    from public.arbitros where arbitro_id ~ '^A[0-9]+$';
  insert into public.arbitros (arbitro_id, nombre) values (v_id, v_nombre);
  return v_id;
end;
$$;

-- Une dos códigos: los partidos de p_sobra pasan a p_queda y p_sobra se borra.
create or replace function unir_arbitros(p_queda text, p_sobra text)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_n int;
  v_notas text;
begin
  if not public.es_admin() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if p_queda = p_sobra or not exists (select 1 from public.arbitros where arbitro_id = p_queda)
     or not exists (select 1 from public.arbitros where arbitro_id = p_sobra) then
    raise exception 'árbitros para unir no válidos' using errcode = '22023';
  end if;
  update public.partidos set arbitro_id = p_queda where arbitro_id = p_sobra;
  get diagnostics v_n = row_count;
  select notas into v_notas from public.arbitros where arbitro_id = p_sobra;
  if nullif(trim(coalesce(v_notas, '')), '') is not null then
    update public.arbitros set notas = concat_ws(' · ', nullif(trim(coalesce(notas, '')), ''), v_notas) where arbitro_id = p_queda;
  end if;
  delete from public.arbitros where arbitro_id = p_sobra;
  return v_n;
end;
$$;
grant execute on function crear_arbitro(text), unir_arbitros(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Paso a código: solo si todavía existe la columna de texto.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'partidos' and column_name = 'arbitro') then
    return;
  end if;

  -- un árbitro por nombre, numerados por orden alfabético
  insert into arbitros (arbitro_id, nombre)
  select 'A' || lpad((coalesce((select max(substring(arbitro_id from 2)::int) from arbitros where arbitro_id ~ '^A[0-9]+$'), 0)
           + row_number() over (order by n.nombre))::text, 3, '0'), n.nombre
  from (
    select min(nombre_arbitro(arbitro)) as nombre
    from partidos
    where nombre_arbitro(arbitro) is not null
    group by lower(nombre_arbitro(arbitro))
  ) n
  where not exists (select 1 from arbitros a where lower(trim(a.nombre)) = lower(n.nombre));

  execute 'alter table partidos disable trigger user';
  update partidos p set arbitro_id = a.arbitro_id
  from arbitros a
  where lower(trim(a.nombre)) = lower(nombre_arbitro(p.arbitro)) and p.arbitro_id is null;
  execute 'alter table partidos enable trigger user';

  if exists (select 1 from partidos where nombre_arbitro(arbitro) is not null and arbitro_id is null) then
    raise exception 'quedaron partidos con árbitro sin código: no se borra la columna vieja';
  end if;
end;
$$;

-- v_partidos sin partidos.arbitro (igual que en 02, con las columnas de partidos
-- escritas una por una para poder borrar la vieja). 02 la vuelve a crear igual.
create or replace view v_partidos with (security_invoker = true) as
with propio as (
  select equipo_id from equipos where es_propio limit 1
),
base as (
  select
    p.partido_id, p.torneo_id, p.fase, p.zona, p.serie, p.fecha_nro, p.fecha, p.hora, p.categoria, p.local_id, p.visitante_id,
    p.goles_local, p.goles_visitante, p.penales_local, p.penales_visitante, p.resultado_informado, p.cancha, p.arbitro_id,
    p.estado, p.completitud, p.fuente_ids, p.observaciones, p.publicado, p.creado_en, p.actualizado_en,
    (p.local_id = pr.equipo_id) as es_local,
    pr.equipo_id as propio_id
  from partidos p
  cross join propio pr
  where pr.equipo_id in (p.local_id, p.visitante_id)
),
calc as (
  select
    b.*,
    case when b.es_local then b.goles_local else b.goles_visitante end as gf,
    case when b.es_local then b.goles_visitante else b.goles_local end as gc,
    case when b.es_local then b.penales_local else b.penales_visitante end as penales_favor,
    case when b.es_local then b.penales_visitante else b.penales_local end as penales_contra,
    case when b.es_local then b.visitante_id else b.local_id end as rival_id
  from base b
)
select
  c.partido_id,
  c.torneo_id,
  t.anio,
  t.nombre        as torneo,
  t.competicion,
  t.tipo          as torneo_tipo,
  t.orden         as torneo_orden,
  c.fase,
  orden_fase(c.fase) as fase_orden,
  c.zona,
  c.serie,
  c.fecha_nro,
  c.fecha,
  c.hora,
  c.categoria,
  c.local_id,
  el.nombre_corto as local,
  c.visitante_id,
  ev.nombre_corto as visitante,
  c.goles_local,
  c.goles_visitante,
  c.penales_local,
  c.penales_visitante,
  case when c.es_local then 'L' else 'V' end as condicion,
  c.rival_id,
  er.nombre_corto as rival,
  c.gf,
  c.gc,
  c.penales_favor,
  c.penales_contra,
  case
    when c.estado in ('Programado', 'Postergado') then null
    when c.gf is not null then
      case when c.gf > c.gc then 'G' when c.gf < c.gc then 'P' else 'E' end
    else c.resultado_informado
  end as resultado,
  gm.texto  as goles_mitre_texto,
  gr.texto  as goles_rival_texto,
  coalesce(inc.rojas, 0) as rojas,
  coalesce(inc.rojas, 0) > 0 as tiene_rojas,
  c.cancha,
  ar.nombre       as arbitro,
  c.estado,
  c.completitud,
  c.fuente_ids,
  c.observaciones,
  c.publicado,
  c.creado_en,
  c.actualizado_en,
  c.arbitro_id
from calc c
join torneos t  on t.torneo_id  = c.torneo_id
join equipos el on el.equipo_id = c.local_id
join equipos ev on ev.equipo_id = c.visitante_id
join equipos er on er.equipo_id = c.rival_id
left join arbitros ar on ar.arbitro_id = c.arbitro_id   -- 6.7.3: el nombre sale del código
-- Goles del club propio: "Ruiz Díaz G. ×2, Villarruel D., en contra"
left join lateral (
  select string_agg(x.etiqueta || case when x.n > 1 then ' ×' || x.n else '' end, ', ' order by x.primero, x.primer_id) as texto
  from (
    select
      case
        when g.tipo = 'En contra' then 'en contra'
        when j.jugador_id is not null then
          j.apellido || coalesce(' ' || left(nullif(trim(j.nombre), ''), 1) || '.', '')
        else coalesce(nullif(trim(g.nombre_en_fuente), ''), 'sin dato')
      end as etiqueta,
      count(*) as n,
      -- orden de aparición: por tiempo y minuto si se conocen, si no por orden de carga
      min(case g.tiempo when '2T' then 200 when 'Suplementario' then 400 else 0 end
          + coalesce(g.minuto, 199)) as primero,
      min(g.gol_id) as primer_id
    from goles g
    left join jugadores j on j.jugador_id = g.jugador_id
    where g.partido_id = c.partido_id and g.equipo_id = c.propio_id
    group by 1
  ) x
) gm on true
-- Goles del rival: nombre como vino en la fuente
left join lateral (
  select string_agg(x.etiqueta || case when x.n > 1 then ' ×' || x.n else '' end, ', ' order by x.etiqueta) as texto
  from (
    select
      case
        when g.tipo = 'En contra' then 'en contra'
        else coalesce(nullif(trim(g.nombre_en_fuente), ''), 'sin dato')
      end as etiqueta,
      count(*) as n
    from goles g
    where g.partido_id = c.partido_id and g.equipo_id = c.rival_id
    group by 1
  ) x
) gr on true
left join lateral (
  select count(*) as rojas
  from incidencias i
  where i.partido_id = c.partido_id and i.tipo in ('Roja', 'Doble amarilla')
) inc on true;

alter table partidos drop column if exists arbitro;
