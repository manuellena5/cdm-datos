-- =====================================================================
-- 08_pendientes.sql — Lo que falta cargar, para el panel de administrador.
-- Correr después de 07. Se puede volver a correr.
--
-- - torneos.fechas_regular: cuántas fechas tiene la fase regular. Si está vacío,
--   se toma la última fecha cargada (así no se ven las que faltan al final).
-- - fechas_libres: fechas en las que Mitre no jugó (quedó libre o la fecha no se jugó),
--   para que no figuren como pendientes. Vale para Primera y Reserva.
-- - v_fechas_faltantes: fechas de la fase regular sin partido cargado, por torneo y categoría.
--   En las ligas se esperan Primera y Reserva; en las copas, solo las categorías que tienen algún partido.
-- Qué se rompe: nada. Son una columna, una tabla y una vista nuevas.
-- =====================================================================

alter table torneos add column if not exists fechas_regular int;
alter table torneos drop constraint if exists torneos_fechas_regular_chk;
alter table torneos add constraint torneos_fechas_regular_chk check (fechas_regular > 0);

create table if not exists fechas_libres (
  torneo_id  text not null references torneos (torneo_id) on update cascade on delete cascade,
  fecha_nro  int  not null check (fecha_nro > 0),
  motivo     text not null default 'Libre' constraint fechas_libres_motivo_chk check (motivo in ('Libre', 'No se jugó')),
  creado_en  timestamptz not null default now(),
  primary key (torneo_id, fecha_nro)
);
alter table fechas_libres enable row level security;
drop policy if exists lectura on fechas_libres;
create policy lectura on fechas_libres for select to anon, authenticated using (true);
grant select on fechas_libres to anon, authenticated;

-- Escritura solo para administradores (torneos: para guardar la cantidad de fechas)
do $$
declare
  t text;
begin
  foreach t in array array['fechas_libres', 'torneos'] loop
    execute format('drop policy if exists escritura_admin on %I', t);
    execute format('create policy escritura_admin on %I for all to authenticated using (es_admin()) with check (es_admin())', t);
    execute format('revoke insert, update, delete, truncate on %I from anon', t);
    execute format('grant insert, update, delete on %I to authenticated', t);
  end loop;
end;
$$;

drop view if exists v_fechas_faltantes;
create view v_fechas_faltantes with (security_invoker = true) as
with regulares as (
  select torneo_id, categoria, fecha_nro
  from partidos
  where fase = 'Regular' and fecha_nro is not null
),
categorias as (
  select t.torneo_id, c.categoria
  from torneos t
  cross join (values ('Primera'), ('Reserva')) as c (categoria)
  where t.tipo = 'Liga'
     or exists (select 1 from partidos p where p.torneo_id = t.torneo_id and p.categoria = c.categoria)
),
hasta as (
  select t.torneo_id,
         coalesce(t.fechas_regular, (select max(r.fecha_nro) from regulares r where r.torneo_id = t.torneo_id)) as n
  from torneos t
)
select
  c.torneo_id,
  t.nombre  as torneo,
  t.anio,
  t.orden   as torneo_orden,
  c.categoria,
  g.n       as fecha_nro
from categorias c
join torneos t on t.torneo_id = c.torneo_id
join hasta h on h.torneo_id = c.torneo_id
cross join lateral generate_series(1, coalesce(h.n, 0)) as g (n)
where not exists (select 1 from regulares r where r.torneo_id = c.torneo_id and r.categoria = c.categoria and r.fecha_nro = g.n)
  and not exists (select 1 from fechas_libres l where l.torneo_id = c.torneo_id and l.fecha_nro = g.n);
grant select on v_fechas_faltantes to anon, authenticated;
