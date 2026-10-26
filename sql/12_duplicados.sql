-- =====================================================================
-- 12_duplicados.sql — Posibles duplicados de jugadores (6.5.3).
-- Correr después de 11. Se puede volver a correr.
-- Qué se rompe: nada.
-- - jugadores_distintos es una tabla nueva: los pares que el administrador
--   marcó como "No son el mismo". Si uno de los dos se une con otro y
--   desaparece, sus pares se borran solos (on delete cascade), así que
--   unir_jugadores no cambia.
-- - v_posibles_duplicados y v_datos_jugador son vistas nuevas que solo leen
--   tablas (no dependen de las vistas de 02, que se recrean).
-- - pasar_dato es una función nueva: mueve un gol, una incidencia o una fila
--   de formación de un jugador a otro sin unirlos (queda en la auditoría
--   como cambio del partido).
-- =====================================================================

-- ---------- Pares descartados ----------
create table if not exists jugadores_distintos (
  id          bigint generated always as identity primary key,
  jugador_a   text not null references jugadores (jugador_id) on update cascade on delete cascade,
  jugador_b   text not null references jugadores (jugador_id) on update cascade on delete cascade,
  motivo      text,
  creado_en   timestamptz not null default now(),
  creado_por  text,                                   -- nombre del administrador, lo pone el trigger
  constraint jugadores_distintos_orden_chk check (jugador_a < jugador_b),
  constraint jugadores_distintos_par_uq unique (jugador_a, jugador_b)
);
create index if not exists jugadores_distintos_b_idx on jugadores_distintos (jugador_b);

alter table jugadores_distintos enable row level security;
drop policy if exists solo_admin on jugadores_distintos;
create policy solo_admin on jugadores_distintos for all to authenticated using (es_admin()) with check (es_admin());
revoke all on jugadores_distintos from anon;
grant select, insert, update, delete on jugadores_distintos to authenticated;

-- creado_por: la misma función que fechas_libres (11_fechas_libres_quien.sql)
drop trigger if exists jugadores_distintos_creado_por on jugadores_distintos;
create trigger jugadores_distintos_creado_por before insert on jugadores_distintos
  for each row execute function poner_creado_por();

-- ---------- Apellido para comparar ----------
-- Sin mayúsculas, sin acentos, solo letras y con las letras dobles juntadas
-- (Fossarelli y Fosarelli dan lo mismo).
create or replace function clave_apellido(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(
             translate(lower(trim(coalesce(p, ''))), 'áéíóúüàèìòùäëïöâêîôû', 'aeiouuaeiouaeioaeiou'),
             '[^a-zñ]', '', 'g'),
           '(.)\1+', '\1', 'g');
$$;

-- ---------- Posibles duplicados ----------
-- Un par por jugadores con el mismo apellido para comparar, más los pares ya
-- descartados (aunque después se haya corregido el apellido).
-- partidos_juntos: partidos donde aparecen los dos (gol, incidencia o formación).
-- Si es más de 0, no pueden ser la misma persona.
-- listas_juntos: listas de torneo (planteles) donde están los dos. Es solo un dato.
drop view if exists v_posibles_duplicados;
create view v_posibles_duplicados with (security_invoker = true) as
with claves as (
  select jugador_id, public.clave_apellido(apellido) as clave
  from jugadores
  where public.clave_apellido(apellido) <> ''
),
pares as (
  select a.jugador_id as jugador_a, b.jugador_id as jugador_b
  from claves a join claves b on b.clave = a.clave and a.jugador_id < b.jugador_id
  union
  select jugador_a, jugador_b from jugadores_distintos
),
apariciones as (
  select jugador_id, partido_id from goles where jugador_id is not null
  union
  select jugador_id, partido_id from incidencias where jugador_id is not null
  union
  select jugador_id, partido_id from formaciones
)
select
  p.jugador_a,
  p.jugador_b,
  (select count(*) from apariciones x join apariciones y on y.partido_id = x.partido_id
    where x.jugador_id = p.jugador_a and y.jugador_id = p.jugador_b)::int as partidos_juntos,
  (select count(*) from planteles x join planteles y on y.torneo_id = x.torneo_id and y.categoria = x.categoria
    where x.jugador_id = p.jugador_a and y.jugador_id = p.jugador_b)::int as listas_juntos,
  (d.id is not null) as descartado,
  d.motivo,
  d.creado_en as descartado_en,
  d.creado_por as descartado_por
from pares p
left join jugadores_distintos d on d.jugador_a = p.jugador_a and d.jugador_b = p.jugador_b;
grant select on v_posibles_duplicados to authenticated;

-- ---------- Cada dato de un jugador ----------
-- Una fila por gol, incidencia o fila de formación, para comparar dos jugadores
-- partido por partido y pasar un dato de uno al otro.
drop view if exists v_datos_jugador;
create view v_datos_jugador with (security_invoker = true) as
select g.jugador_id, g.partido_id, 'gol'::text as clase, g.gol_id as dato_id,
  case g.tipo when 'Penal' then 'Gol de penal' when 'Tiro libre' then 'Gol de tiro libre' else 'Gol' end as detalle,
  g.minuto
from goles g
where g.jugador_id is not null and g.tipo <> 'En contra'
union all
select i.jugador_id, i.partido_id, 'incidencia', i.id::text, i.tipo, i.minuto
from incidencias i
where i.jugador_id is not null
union all
select f.jugador_id, f.partido_id, 'formacion', null,
  case f.rol when 'Convocado (suplente)' then 'Convocado' else f.rol end || case when f.capitan then ' (capitán)' else '' end,
  null
from formaciones f;
grant select on v_datos_jugador to authenticated;

-- ---------- Pasar un dato de un jugador a otro ----------
-- p_clase: 'gol' (p_dato = gol_id), 'incidencia' (p_dato = id) o 'formacion'
-- (p_dato vacío: la fila de p_de en p_partido).
create or replace function pasar_dato(p_clase text, p_dato text, p_partido text, p_de text, p_a text)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_n int;
begin
  if not public.es_admin() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if p_de = p_a then
    raise exception 'CDM: Elegí dos jugadores distintos.';
  end if;
  if not exists (select 1 from public.jugadores where jugador_id = p_a) then
    raise exception 'CDM: No se encontró el jugador. Recargá la página.';
  end if;
  if p_clase = 'gol' then
    update public.goles set jugador_id = p_a where gol_id = p_dato and jugador_id = p_de;
  elsif p_clase = 'incidencia' then
    update public.incidencias set jugador_id = p_a where id = p_dato::bigint and jugador_id = p_de;
  elsif p_clase = 'formacion' then
    if exists (select 1 from public.formaciones where partido_id = p_partido and jugador_id = p_a) then
      raise exception 'CDM: Los dos están en la formación de ese partido. Corregí la formación desde el partido.';
    end if;
    update public.formaciones set jugador_id = p_a where partido_id = p_partido and jugador_id = p_de;
  else
    raise exception 'CDM: No se reconoce el dato.';
  end if;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'CDM: Ese dato ya no está. Recargá la página.';
  end if;
  return v_n;
end;
$$;
revoke execute on function pasar_dato(text, text, text, text, text) from public, anon;
grant execute on function pasar_dato(text, text, text, text, text) to authenticated;
