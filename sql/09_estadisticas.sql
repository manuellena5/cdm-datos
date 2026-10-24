-- =====================================================================
-- 09_estadisticas.sql — Fase 6: estadísticas de jugadores y planteles.
-- Correr después de 08 y de 10 (usa la tabla planteles). Se puede volver a correr.
-- Solo cuenta partidos publicados.
-- Qué se rompe: nada. Son vistas nuevas.
--
-- Cómo se cuenta:
-- - Un jugador "estuvo" en un partido si figura en la formación, hizo un gol o tuvo una incidencia.
-- - "Jugó" (jugo = true): titular, suplente que entró, o sin formación cargada pero con gol o tarjeta.
--   Convocado (suplente) sin gol ni tarjeta: no se sabe si entró (jugo = null). Suplente sin jugar: false.
-- - Minutos: solo si hay datos (titular con minuto de salida, o suplente con minuto de entrada y de salida).
--   No se supone la duración del partido: sin esos datos, los minutos quedan vacíos.
-- =====================================================================

drop view if exists v_plantel, v_jugador_partidos;

create view v_jugador_partidos with (security_invoker = true) as
with pares as (
  select jugador_id, partido_id from formaciones
  union
  select jugador_id, partido_id from goles where jugador_id is not null and tipo <> 'En contra'
  union
  select jugador_id, partido_id from incidencias where jugador_id is not null
),
conteos as (
  select
    p.jugador_id,
    p.partido_id,
    (select count(*) from goles g where g.partido_id = p.partido_id and g.jugador_id = p.jugador_id and g.tipo <> 'En contra') as goles,
    (select count(*) from incidencias i where i.partido_id = p.partido_id and i.jugador_id = p.jugador_id and i.tipo = 'Amarilla') as amarillas,
    (select count(*) from incidencias i where i.partido_id = p.partido_id and i.jugador_id = p.jugador_id and i.tipo in ('Roja', 'Doble amarilla')) as rojas
  from pares p
)
select
  c.jugador_id,
  v.partido_id,
  v.torneo_id,
  v.anio,
  v.torneo,
  v.torneo_tipo,
  v.torneo_orden,
  v.categoria,
  v.fase,
  v.fase_orden,
  v.serie,
  v.fecha_nro,
  v.fecha,
  v.rival_id,
  v.rival,
  v.condicion,
  v.gf,
  v.gc,
  v.resultado,
  f.rol,
  coalesce(f.capitan, false) as capitan,
  f.nro_lista,
  f.camiseta,
  f.minuto_entra,
  f.minuto_sale,
  case
    when f.rol in ('Titular', 'Suplente que entró') then true
    when f.rol = 'Suplente sin jugar' then false
    when c.goles > 0 or c.amarillas > 0 or c.rojas > 0 then true
    else null
  end as jugo,
  case
    when f.rol = 'Titular' and f.minuto_sale is not null then f.minuto_sale
    when f.rol = 'Suplente que entró' and f.minuto_entra is not null and f.minuto_sale is not null then greatest(f.minuto_sale - f.minuto_entra, 0)
  end as minutos,
  c.goles,
  c.amarillas,
  c.rojas
from conteos c
join v_partidos_publicados v on v.partido_id = c.partido_id
left join formaciones f on f.partido_id = c.partido_id and f.jugador_id = c.jugador_id;

-- Plantel: una fila por jugador, torneo y categoría. Incluye a los de la lista del torneo
-- (tabla planteles, 10_planteles.sql) aunque todavía no tengan partidos (en_lista = true).
create view v_plantel with (security_invoker = true) as
with estadisticas as (
  select
    jp.jugador_id,
    jp.torneo_id,
    jp.categoria,
    count(*)                                                as presencias,
    count(*) filter (where jp.jugo)                         as partidos,
    count(*) filter (where jp.rol = 'Titular')              as titular,
    count(*) filter (where jp.rol = 'Suplente que entró')   as entro,
    count(*) filter (where jp.rol = 'Convocado (suplente)') as convocado,
    count(*) filter (where jp.capitan)                      as capitan,
    sum(jp.minutos)                                         as minutos,
    sum(jp.goles)                                           as goles,
    sum(jp.amarillas)                                       as amarillas,
    sum(jp.rojas)                                           as rojas
  from v_jugador_partidos jp
  group by jp.jugador_id, jp.torneo_id, jp.categoria
),
juntos as (
  select
    coalesce(s.jugador_id, l.jugador_id) as jugador_id,
    coalesce(s.torneo_id, l.torneo_id)   as torneo_id,
    coalesce(s.categoria, l.categoria)   as categoria,
    s.presencias, s.partidos, s.titular, s.entro, s.convocado, s.capitan, s.minutos, s.goles, s.amarillas, s.rojas,
    (l.jugador_id is not null) as en_lista,
    l.camiseta,
    l.posicion
  from estadisticas s
  full join planteles l on l.jugador_id = s.jugador_id and l.torneo_id = s.torneo_id and l.categoria = s.categoria
)
select
  x.jugador_id,
  j.apellido,
  j.nombre,
  j.apellido || coalesce(', ' || nullif(trim(j.nombre), ''), '') as jugador,
  x.torneo_id,
  t.anio,
  t.nombre as torneo,
  t.tipo   as torneo_tipo,
  t.orden  as torneo_orden,
  x.categoria,
  coalesce(x.presencias, 0) as presencias,
  coalesce(x.partidos, 0)   as partidos,
  coalesce(x.titular, 0)    as titular,
  coalesce(x.entro, 0)      as entro,
  coalesce(x.convocado, 0)  as convocado,
  coalesce(x.capitan, 0)    as capitan,
  x.minutos,
  coalesce(x.goles, 0)      as goles,
  coalesce(x.amarillas, 0)  as amarillas,
  coalesce(x.rojas, 0)      as rojas,
  x.en_lista,
  x.camiseta,
  x.posicion
from juntos x
join jugadores j on j.jugador_id = x.jugador_id
join torneos t on t.torneo_id = x.torneo_id;

grant select on v_jugador_partidos, v_plantel to anon, authenticated;
