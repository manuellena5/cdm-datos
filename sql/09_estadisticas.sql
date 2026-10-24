-- =====================================================================
-- 09_estadisticas.sql — Fase 6: estadísticas de jugadores y planteles.
-- Correr después de 08 (y de volver a correr 05). Se puede volver a correr.
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

-- Plantel: una fila por jugador, torneo y categoría.
create view v_plantel with (security_invoker = true) as
select
  jp.jugador_id,
  j.apellido,
  j.nombre,
  j.apellido || coalesce(', ' || nullif(trim(j.nombre), ''), '') as jugador,
  jp.torneo_id,
  jp.anio,
  jp.torneo,
  jp.torneo_tipo,
  jp.torneo_orden,
  jp.categoria,
  count(*)                                              as presencias,
  count(*) filter (where jp.jugo)                       as partidos,
  count(*) filter (where jp.rol = 'Titular')            as titular,
  count(*) filter (where jp.rol = 'Suplente que entró') as entro,
  count(*) filter (where jp.rol = 'Convocado (suplente)') as convocado,
  count(*) filter (where jp.capitan)                    as capitan,
  sum(jp.minutos)                                       as minutos,
  sum(jp.goles)                                         as goles,
  sum(jp.amarillas)                                     as amarillas,
  sum(jp.rojas)                                         as rojas
from v_jugador_partidos jp
join jugadores j on j.jugador_id = jp.jugador_id
group by jp.jugador_id, j.apellido, j.nombre, jp.torneo_id, jp.anio, jp.torneo, jp.torneo_tipo, jp.torneo_orden, jp.categoria;

grant select on v_jugador_partidos, v_plantel to anon, authenticated;
