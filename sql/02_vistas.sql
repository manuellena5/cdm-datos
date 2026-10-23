-- =====================================================================
-- 02_vistas.sql — Vistas "desde el punto de vista del club propio"
-- Correr después de 01_esquema.sql y antes de 03_permisos.sql.
-- El club propio sale de equipos.es_propio: ninguna vista tiene el ID escrito.
-- Las vistas se borran y se vuelven a crear (no guardan datos), así un cambio
-- de columnas no falla al volver a correr. Después correr 03_permisos.sql.
-- security_invoker: cada vista respeta los permisos (RLS) de quien consulta,
-- así los borradores no se filtran por las vistas.
-- =====================================================================

drop view if exists v_formaciones, v_incidencias, v_goles,
  v_disciplina, v_faltantes, v_historial_rival, v_goleadores, v_campanas, v_partidos_publicados, v_partidos cascade;
drop function if exists orden_fase(text);

-- Orden de las instancias, para saber hasta dónde llegó el equipo.
create function orden_fase(fase text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case fase
    when 'Regular' then 0 when 'Zona' then 0 when 'Interzonal' then 0 when 'Grupos' then 0
    when 'Playoff' then 1   -- playoff de instancia desconocida: la más baja
    when '32avos' then 1 when '16avos' then 2 when 'Octavos' then 3
    when 'Cuartos' then 4 when 'Semifinal' then 5 when 'Final' then 6
  end
$$;

-- ---------------------------------------------------------------------
-- v_partidos: cada partido visto desde el club propio.
-- ---------------------------------------------------------------------
create view v_partidos with (security_invoker = true) as
with propio as (
  select equipo_id from equipos where es_propio limit 1
),
base as (
  select
    p.*,
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
  c.arbitro,
  c.estado,
  c.completitud,
  c.fuente_ids,
  c.observaciones,
  c.publicado,
  c.creado_en,
  c.actualizado_en
from calc c
join torneos t  on t.torneo_id  = c.torneo_id
join equipos el on el.equipo_id = c.local_id
join equipos ev on ev.equipo_id = c.visitante_id
join equipos er on er.equipo_id = c.rival_id
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

-- ---------------------------------------------------------------------
-- v_partidos_publicados: lo que cuenta en campañas, goleadores, historial y
-- disciplina. Los borradores no suman nunca, ni siquiera con sesión iniciada.
-- ---------------------------------------------------------------------
create view v_partidos_publicados with (security_invoker = true) as
select * from v_partidos where publicado;

-- ---------------------------------------------------------------------
-- v_campanas: por torneo y categoría. La tabla suma solo la fase regular
-- (incluye zonas e interzonales). El playoff va aparte: hasta dónde llegó.
-- ---------------------------------------------------------------------
create view v_campanas with (security_invoker = true) as
with regular as (
  select *
  from v_partidos_publicados
  where fase_orden = 0
    and estado in ('Jugado', 'Ganado por mesa')
    and resultado is not null
),
tabla as (
  select
    torneo_id,
    categoria,
    count(*)                                   as pj,
    count(*) filter (where resultado = 'G')    as g,
    count(*) filter (where resultado = 'E')    as e,
    count(*) filter (where resultado = 'P')    as p,
    coalesce(sum(gf), 0)                       as gf,
    coalesce(sum(gc), 0)                       as gc
  from regular
  group by torneo_id, categoria
),
todos as (
  select
    torneo_id,
    categoria,
    count(*) filter (where fase_orden = 0 and estado = 'Programado')                    as programados,
    count(*) filter (where fase_orden = 0 and estado <> 'Programado' and resultado is null) as sin_dato,
    (array_agg(fase order by fase_orden desc) filter (where fase_orden > 0))[1]          as llego_a,
    count(*) filter (where fase_orden > 0 and resultado is not null)                     as playoff_pj
  from v_partidos_publicados
  group by torneo_id, categoria
),
-- Goles propios que no van a la tabla de goleadores
goles_extra as (
  select
    pa.torneo_id,
    pa.categoria,
    count(*) filter (where g.tipo = 'En contra')                         as en_contra,
    count(*) filter (where g.tipo <> 'En contra' and g.jugador_id is null) as sin_autor
  from goles g
  join partidos pa on pa.partido_id = g.partido_id and pa.publicado
  join equipos e on e.equipo_id = g.equipo_id and e.es_propio
  group by pa.torneo_id, pa.categoria
),
-- Zona en la que jugó la fase regular (sin contar los interzonales)
zona as (
  select torneo_id, categoria, mode() within group (order by zona) as zona
  from v_partidos_publicados
  where fase_orden = 0 and zona is not null and zona <> 'Interzonal'
  group by torneo_id, categoria
),
-- Última llave de playoff: en ida y vuelta se suman los dos partidos.
-- Los penales son los del partido que definió (solo uno los tiene).
ultima_llave as (
  select
    v.torneo_id,
    v.categoria,
    max(v.rival)            as rival,
    count(v.resultado)      as jugados,
    sum(v.gf)               as gf,
    sum(v.gc)               as gc,
    max(v.penales_favor)    as penales_favor,
    max(v.penales_contra)   as penales_contra
  from v_partidos_publicados v
  join (
    select torneo_id, categoria, max(fase_orden) as fase_orden
    from v_partidos_publicados
    where fase_orden > 0
    group by torneo_id, categoria
  ) u on u.torneo_id = v.torneo_id and u.categoria = v.categoria and u.fase_orden = v.fase_orden
  group by v.torneo_id, v.categoria
),
ultima_posicion as (
  select distinct on (torneo_id, categoria)
    torneo_id, categoria, posicion, tras_fecha
  from posiciones
  where posicion is not null
  order by torneo_id, categoria, tras_fecha desc
)
select
  t.torneo_id,
  t.anio,
  t.nombre       as torneo,
  t.competicion,
  t.tipo         as torneo_tipo,
  t.orden        as torneo_orden,
  x.categoria,
  coalesce(tb.pj, 0) as pj,
  coalesce(tb.g, 0)  as g,
  coalesce(tb.e, 0)  as e,
  coalesce(tb.p, 0)  as p,
  coalesce(tb.gf, 0) as gf,
  coalesce(tb.gc, 0) as gc,
  coalesce(tb.gf, 0) - coalesce(tb.gc, 0) as dg,
  coalesce(tb.g, 0) * 3 + coalesce(tb.e, 0) as pts,
  x.programados,
  x.sin_dato,
  coalesce(ge.en_contra, 0) as goles_en_contra_a_favor,
  coalesce(ge.sin_autor, 0) as goles_sin_autor,
  z.zona,
  x.llego_a,
  x.playoff_pj,
  ul.rival as playoff_rival,
  -- true: ganó la última llave (si es la final, campeón) · false: quedó eliminado · null: sin dato
  case
    when ul.jugados is null or ul.jugados = 0 then null
    when ul.gf > ul.gc then true
    when ul.gf < ul.gc then false
    when ul.penales_favor is not null then ul.penales_favor > ul.penales_contra
  end as playoff_gano,
  case when ul.jugados > 0 then (ul.gf = ul.gc and ul.penales_favor is not null) end as playoff_por_penales,
  up.posicion   as ultima_posicion,
  up.tras_fecha as ultima_posicion_fecha
from todos x
join torneos t on t.torneo_id = x.torneo_id
left join tabla tb on tb.torneo_id = x.torneo_id and tb.categoria = x.categoria
left join goles_extra ge on ge.torneo_id = x.torneo_id and ge.categoria = x.categoria
left join zona z on z.torneo_id = x.torneo_id and z.categoria = x.categoria
left join ultima_llave ul on ul.torneo_id = x.torneo_id and ul.categoria = x.categoria
left join ultima_posicion up on up.torneo_id = x.torneo_id and up.categoria = x.categoria;

-- ---------------------------------------------------------------------
-- v_goles: cada gol con su lado (propio / rival) y el autor para mostrar.
-- ---------------------------------------------------------------------
create view v_goles with (security_invoker = true) as
select
  g.gol_id,
  g.partido_id,
  v.categoria,
  case when g.equipo_id = v.rival_id then 'rival' else 'propio' end as lado,
  g.jugador_id,
  case
    when g.tipo = 'En contra' and coalesce(g.nombre_en_fuente, '') ilike 'en contra%' then g.nombre_en_fuente
    when g.tipo = 'En contra' then 'En contra' || coalesce(' (' || nullif(trim(g.nombre_en_fuente), '') || ')', '')
    when j.jugador_id is not null then j.apellido || coalesce(', ' || nullif(trim(j.nombre), ''), '')
    else coalesce(nullif(trim(g.nombre_en_fuente), ''), 'Sin dato')
  end as autor,
  g.minuto,
  g.tiempo,
  g.tipo,
  (case g.tiempo when '2T' then 200 when 'Suplementario' then 400 else 0 end
     + coalesce(g.minuto, 199)) as orden
from goles g
join v_partidos v on v.partido_id = g.partido_id
left join jugadores j on j.jugador_id = g.jugador_id;

-- ---------------------------------------------------------------------
-- v_incidencias: rojas, penales, etc. con su lado y el nombre para mostrar.
-- ---------------------------------------------------------------------
create view v_incidencias with (security_invoker = true) as
select
  i.id,
  i.partido_id,
  v.categoria,
  case
    when i.equipo_id is null then 'partido'
    when i.equipo_id = v.rival_id then 'rival'
    else 'propio'
  end as lado,
  i.jugador_id,
  coalesce(j.apellido || coalesce(', ' || nullif(trim(j.nombre), ''), ''), nullif(trim(i.nombre_en_fuente), '')) as quien,
  i.tipo,
  i.minuto,
  i.tiempo,
  i.descripcion,
  (case i.tiempo when '2T' then 200 when 'Suplementario' then 400 else 0 end
     + coalesce(i.minuto, 199)) as orden
from incidencias i
join v_partidos v on v.partido_id = i.partido_id
left join jugadores j on j.jugador_id = i.jugador_id;

-- ---------------------------------------------------------------------
-- v_formaciones: formación con el nombre del jugador.
-- ---------------------------------------------------------------------
create view v_formaciones with (security_invoker = true) as
select
  f.partido_id,
  v.categoria,
  f.jugador_id,
  j.apellido || coalesce(', ' || nullif(trim(j.nombre), ''), '') as jugador,
  f.rol,
  f.nro_lista,
  f.camiseta,
  f.minuto_entra,
  f.minuto_sale,
  f.capitan
from formaciones f
join v_partidos v on v.partido_id = f.partido_id
join jugadores j on j.jugador_id = f.jugador_id;

-- ---------------------------------------------------------------------
-- v_goleadores: goles por jugador, torneo y categoría (sin "En contra").
-- Sumable por año o por todo el historial.
-- ---------------------------------------------------------------------
create view v_goleadores with (security_invoker = true) as
select
  j.jugador_id,
  j.apellido,
  j.nombre,
  j.apellido || coalesce(', ' || nullif(trim(j.nombre), ''), '') as jugador,
  v.torneo_id,
  v.anio,
  v.torneo,
  v.torneo_tipo,
  v.torneo_orden,
  v.categoria,
  count(*) as goles
from goles g
join v_partidos_publicados v on v.partido_id = g.partido_id
join equipos e on e.equipo_id = g.equipo_id and e.es_propio
join jugadores j on j.jugador_id = g.jugador_id
where g.tipo <> 'En contra'
group by j.jugador_id, j.apellido, j.nombre, v.torneo_id, v.anio, v.torneo, v.torneo_tipo, v.torneo_orden, v.categoria;

-- ---------------------------------------------------------------------
-- v_historial_rival: por rival y categoría, por año y total (anio = null).
-- Cuenta todos los partidos con resultado, de cualquier fase.
-- ---------------------------------------------------------------------
create view v_historial_rival with (security_invoker = true) as
select
  v.rival_id,
  max(v.rival) as rival,
  v.categoria,
  v.anio,                                  -- null = todo el historial
  count(*)                                 as pj,
  count(*) filter (where resultado = 'G')  as g,
  count(*) filter (where resultado = 'E')  as e,
  count(*) filter (where resultado = 'P')  as p,
  coalesce(sum(v.gf), 0)                   as gf,
  coalesce(sum(v.gc), 0)                   as gc,
  count(*) filter (where resultado = 'G') * 3 + count(*) filter (where resultado = 'E') as pts,
  round(100.0 * (count(*) filter (where resultado = 'G') * 3 + count(*) filter (where resultado = 'E'))
        / (3 * count(*)), 1) as porcentaje_puntos
from v_partidos_publicados v
where v.resultado is not null
group by grouping sets ((v.rival_id, v.categoria, v.anio), (v.rival_id, v.categoria));

-- ---------------------------------------------------------------------
-- v_faltantes: una fila con lo que falta cargar (panel de admin).
-- ---------------------------------------------------------------------
create view v_faltantes with (security_invoker = true) as
with jugados as (
  select * from v_partidos where estado = 'Jugado'
),
goles_propios as (
  select g.partido_id, count(*) as n
  from goles g
  join equipos e on e.equipo_id = g.equipo_id and e.es_propio
  group by g.partido_id
),
citadas as (
  select unnest(fuente_ids) as fuente_id from partidos
  union all select unnest(fuente_ids) from torneos
  union all select unnest(fuente_ids) from jugadores
  union all select unnest(fuente_ids) from posiciones
  union all select unnest(fuente_ids) from goleadores_liga
  union all select unnest(fuente_ids) from sanciones
)
select
  (select count(*) from jugados where arbitro is null or trim(arbitro) = '') as sin_arbitro,
  (select count(*) from jugados j
     where not exists (select 1 from formaciones f where f.partido_id = j.partido_id)) as sin_formacion,
  (select count(*) from goles g
     join equipos e on e.equipo_id = g.equipo_id and e.es_propio
     join partidos pa on pa.partido_id = g.partido_id
     where g.jugador_id is null and g.tipo <> 'En contra') as goles_propios_sin_jugador,
  (select count(*) from goles g
     join equipos e on e.equipo_id = g.equipo_id and not e.es_propio
     join partidos pa on pa.partido_id = g.partido_id
     where g.tipo <> 'En contra' and coalesce(trim(g.nombre_en_fuente), '') = '') as goles_rival_sin_autor,
  (select count(*) from v_partidos
     where estado = 'Programado' and fecha < current_date) as programados_vencidos,
  -- partidos con goles cargados cuya cantidad no coincide con los goles a favor
  -- (los que no tienen ningún gol cargado son de completitud "Resultado", no se cuentan)
  (select count(*) from jugados j
     join goles_propios gp on gp.partido_id = j.partido_id
     where j.gf is not null and gp.n <> j.gf) as goles_propios_no_cuadran,
  (select count(distinct c.fuente_id) from citadas c
     where not exists (select 1 from fuentes f where f.fuente_id = c.fuente_id)) as fuentes_inexistentes;

-- ---------------------------------------------------------------------
-- v_disciplina: rojas y expulsiones del club propio por jugador, torneo y categoría.
-- ---------------------------------------------------------------------
create view v_disciplina with (security_invoker = true) as
select
  i.jugador_id,
  coalesce(j.apellido || coalesce(', ' || nullif(trim(j.nombre), ''), ''), i.nombre_en_fuente) as jugador,
  v.torneo_id,
  v.anio,
  v.torneo,
  v.categoria,
  count(*) filter (where i.tipo = 'Roja')             as rojas,
  count(*) filter (where i.tipo = 'Doble amarilla')   as dobles_amarillas,
  count(*) filter (where i.tipo = 'Expulsión del DT') as expulsiones_dt,
  count(*)                                            as total
from incidencias i
join v_partidos_publicados v on v.partido_id = i.partido_id
join equipos e on e.equipo_id = i.equipo_id and e.es_propio
left join jugadores j on j.jugador_id = i.jugador_id
where i.tipo in ('Roja', 'Doble amarilla', 'Expulsión del DT')
group by i.jugador_id, 2, v.torneo_id, v.anio, v.torneo, v.categoria;
