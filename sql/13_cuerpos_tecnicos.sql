-- =====================================================================
-- 13_cuerpos_tecnicos.sql — Cuerpo técnico de cada plantel (6.6.1).
-- Correr después de 12 y después volver a correr 05 (el registro de
-- cambios suma "actualizó el cuerpo técnico de"). Se puede volver a correr.
-- Qué se rompe: nada. Es una tabla nueva.
-- - Por torneo y categoría: orden 0 = técnico, 1 a 3 = integrantes (sin función).
-- - El nombre es texto libre (no es un jugador). Si más adelante hace falta
--   seguir a una persona entre torneos, se normaliza.
-- - Lectura pública y escritura de administradores, como planteles.
-- - id existe solo para la auditoría (registrar_cambio necesita un id).
-- =====================================================================

create table if not exists cuerpos_tecnicos (
  id          bigint generated always as identity primary key,
  torneo_id   text not null references torneos (torneo_id) on update cascade on delete cascade,
  categoria   text not null constraint cuerpos_tecnicos_categoria_chk check (categoria in ('Primera', 'Reserva')),
  orden       int  not null constraint cuerpos_tecnicos_orden_chk check (orden between 0 and 3),
  nombre      text not null constraint cuerpos_tecnicos_nombre_chk check (trim(nombre) <> ''),
  notas       text,
  fuente_ids  text[] not null default '{}',
  creado_en   timestamptz not null default now(),
  constraint cuerpos_tecnicos_lugar_uq unique (torneo_id, categoria, orden)
);

alter table cuerpos_tecnicos enable row level security;
drop policy if exists lectura on cuerpos_tecnicos;
create policy lectura on cuerpos_tecnicos for select to anon, authenticated using (true);
drop policy if exists escritura_admin on cuerpos_tecnicos;
create policy escritura_admin on cuerpos_tecnicos for all to authenticated using (es_admin()) with check (es_admin());
revoke insert, update, delete, truncate on cuerpos_tecnicos from anon;
grant select on cuerpos_tecnicos to anon, authenticated;
grant insert, update, delete on cuerpos_tecnicos to authenticated;

drop trigger if exists cuerpos_tecnicos_auditoria on cuerpos_tecnicos;
create trigger cuerpos_tecnicos_auditoria after insert or update or delete on cuerpos_tecnicos
  for each row execute function registrar_cambio();

-- ---------- Datos que estaban en las observaciones de los partidos ----------
-- Solo se cargan si ese lugar está vacío (no pisa lo que se haya cargado a mano).
-- Reserva 2016C dice "DT: Mingo Magaz y Andrés Chuard": Magaz queda como técnico y Chuard como integrante.
insert into cuerpos_tecnicos (torneo_id, categoria, orden, nombre, notas)
select v.torneo_id, v.categoria, v.orden, v.nombre, v.notas
from (values
  ('2011C', 'Primera', 0, 'Rubén Leyes',    'Según las observaciones de 2011C F9'),
  ('2012A', 'Primera', 0, 'Rubén Leyes',    'Según las observaciones de 2012A F9 ("R. Leyes")'),
  ('2012C', 'Primera', 0, 'Jorge Falappa',  'Según las observaciones de 2012C F6'),
  ('2013C', 'Primera', 0, 'Jorge Falappa',  'Según las observaciones de 2013C F10'),
  ('2016C', 'Reserva', 0, 'Mingo Magaz',    'Según las observaciones de la final de 2016C: "DT: Mingo Magaz y Andrés Chuard"'),
  ('2016C', 'Reserva', 1, 'Andrés Chuard',  'Según las observaciones de la final de 2016C: "DT: Mingo Magaz y Andrés Chuard"')
) as v (torneo_id, categoria, orden, nombre, notas)
where exists (select 1 from torneos t where t.torneo_id = v.torneo_id)
on conflict (torneo_id, categoria, orden) do nothing;
