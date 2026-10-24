-- =====================================================================
-- 10_planteles.sql — Lista de jugadores de cada torneo y categoría
-- (la "lista de buena fe"), que se carga desde Administrar → Planteles.
-- Correr después de 09. Después volver a correr 07 (unir_jugadores ahora
-- también mueve las listas) y 09 (v_plantel incluye a los de la lista).
-- Qué se rompe: nada. Es una tabla nueva.
-- =====================================================================

create table if not exists planteles (
  torneo_id   text not null references torneos (torneo_id) on update cascade on delete cascade,
  categoria   text not null constraint planteles_categoria_chk check (categoria in ('Primera', 'Reserva')),
  jugador_id  text not null references jugadores (jugador_id) on update cascade on delete cascade,
  camiseta    int  check (camiseta between 0 and 99),
  posicion    text,
  notas       text,
  creado_en   timestamptz not null default now(),
  primary key (torneo_id, categoria, jugador_id)
);
create index if not exists planteles_jugador_idx on planteles (jugador_id);

alter table planteles enable row level security;
drop policy if exists lectura on planteles;
create policy lectura on planteles for select to anon, authenticated using (true);
drop policy if exists escritura_admin on planteles;
create policy escritura_admin on planteles for all to authenticated using (es_admin()) with check (es_admin());
revoke insert, update, delete, truncate on planteles from anon;
grant select on planteles to anon, authenticated;
grant insert, update, delete on planteles to authenticated;

drop trigger if exists planteles_auditoria on planteles;
create trigger planteles_auditoria after insert or update or delete on planteles
  for each row execute function registrar_cambio();
