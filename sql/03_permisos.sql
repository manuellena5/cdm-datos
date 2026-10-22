-- =====================================================================
-- 03_permisos.sql — RLS y permisos de lectura
-- Correr después de 02_vistas.sql (y de nuevo cada vez que se corra 02).
-- Fase 1: lectura pública, escritura todavía no (sin políticas de escritura,
-- RLS bloquea insert/update/delete para anon y authenticated).
-- Los partidos en borrador (publicado = false) no se ven sin iniciar sesión,
-- y tampoco sus goles, incidencias ni formación.
-- =====================================================================

grant usage on schema public to anon, authenticated;

-- ---------- RLS en todas las tablas ----------
alter table fuentes          enable row level security;
alter table torneos          enable row level security;
alter table equipos          enable row level security;
alter table jugadores        enable row level security;
alter table partidos         enable row level security;
alter table goles            enable row level security;
alter table incidencias      enable row level security;
alter table formaciones      enable row level security;
alter table sanciones        enable row level security;
alter table posiciones       enable row level security;
alter table goleadores_liga  enable row level security;

-- ---------- Lectura libre ----------
drop policy if exists lectura on fuentes;
create policy lectura on fuentes for select to anon, authenticated using (true);

drop policy if exists lectura on torneos;
create policy lectura on torneos for select to anon, authenticated using (true);

drop policy if exists lectura on equipos;
create policy lectura on equipos for select to anon, authenticated using (true);

drop policy if exists lectura on jugadores;
create policy lectura on jugadores for select to anon, authenticated using (true);

drop policy if exists lectura on sanciones;
create policy lectura on sanciones for select to anon, authenticated using (true);

drop policy if exists lectura on posiciones;
create policy lectura on posiciones for select to anon, authenticated using (true);

drop policy if exists lectura on goleadores_liga;
create policy lectura on goleadores_liga for select to anon, authenticated using (true);

-- ---------- Partidos: sin sesión, solo los publicados ----------
drop policy if exists lectura_publicados on partidos;
create policy lectura_publicados on partidos for select to anon using (publicado);

drop policy if exists lectura_todo on partidos;
create policy lectura_todo on partidos for select to authenticated using (true);

-- Goles, incidencias y formaciones siguen a su partido
-- (la subconsulta respeta la política de partidos de quien consulta).
drop policy if exists lectura on goles;
create policy lectura on goles for select to anon, authenticated
  using (exists (select 1 from partidos p where p.partido_id = goles.partido_id));

drop policy if exists lectura on incidencias;
create policy lectura on incidencias for select to anon, authenticated
  using (exists (select 1 from partidos p where p.partido_id = incidencias.partido_id));

drop policy if exists lectura on formaciones;
create policy lectura on formaciones for select to anon, authenticated
  using (exists (select 1 from partidos p where p.partido_id = formaciones.partido_id));

-- ---------- Permisos de lectura sobre tablas y vistas ----------
grant select on
  fuentes, torneos, equipos, jugadores, partidos, goles, incidencias,
  formaciones, sanciones, posiciones, goleadores_liga,
  v_partidos, v_campanas, v_goleadores, v_historial_rival, v_faltantes, v_disciplina
to anon, authenticated;

grant execute on function orden_fase(text) to anon, authenticated;
